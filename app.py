from flask import Flask, request, jsonify, render_template
import requests
from urllib.parse import urlparse, parse_qs
import urllib3
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import binascii
from datetime import datetime
import my_pb2
import output_pb2
import game_version  # গেম ভার্সন কনফিগারেশন ফাইল ইমপোর্ট করা হলো

# InsecureRequestWarning হাইড করার জন্য
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

# ====================
# Config & Setup
# ====================
AES_KEY = bytes([89, 103, 38, 116, 99, 37, 68, 69, 117, 104, 54, 37, 90, 99, 94, 56])
AES_IV = bytes([54, 111, 121, 90, 68, 114, 50, 50, 69, 51, 121, 99, 104, 106, 77, 37])

# ====================
# Helper Functions
# ====================
def encrypt_message(plaintext, key_bytes, iv_bytes):
    cipher = AES.new(key_bytes, AES.MODE_CBC, iv_bytes)
    padded_message = pad(plaintext, AES.block_size)
    return cipher.encrypt(padded_message)

def extract_access_token_from_eat(eat_token):
    try:
        url = f"https://api-otrss.garena.com/support/callback/?access_token={eat_token}"
        response = requests.get(url, allow_redirects=True, timeout=30, verify=False)
        
        if 'help.garena.com' in response.url:
            parsed_url = urlparse(response.url)
            params = parse_qs(parsed_url.query)
            
            if 'access_token' in params:
                access_token = params['access_token'][0]
                
                inspect_url = f"https://100067.connect.garena.com/oauth/token/inspect?token={access_token}"
                inspect_response = requests.get(inspect_url, timeout=15, verify=False)
                
                if inspect_response.status_code == 200:
                    token_data = inspect_response.json()
                    if 'open_id' in token_data:
                        return {
                            "success": True,
                            "access_token": access_token,
                            "open_id": token_data['open_id'],
                            "platform_type": token_data.get('platform', 4)
                        }
        return {"success": False, "error": "Invalid EAT Token or Redirection Failed."}
    except Exception as e:
        return {"success": False, "error": f"Token extraction error: {str(e)}"}

def generate_jwt_via_major_login(access_token, open_id, platform_type):
    try:
        game_data = my_pb2.GameData()
        game_data.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        game_data.game_name = "free fire"
        game_data.game_version = 1
        
        # game_version.py থেকে ডাইনামিক ডেটা নেওয়া হচ্ছে
        game_data.version_code = game_version.CLIENT_VERSION 
        game_data.os_info = f"{game_version.ANDROID_OS_VERSION} / API-29 (QKQ1)"
        
        game_data.device_type = "Handheld"
        game_data.network_provider = "Verizon Wireless"
        game_data.connection_type = "WIFI"
        game_data.screen_width = 1280
        game_data.screen_height = 960
        game_data.dpi = "240"
        game_data.cpu_info = "ARMv7 VFPv3 NEON VMH | 2400 | 4"
        game_data.total_ram = 5951
        game_data.gpu_name = "Adreno (TM) 640"
        game_data.gpu_version = "OpenGL ES 3.0"
        game_data.user_id = f"Google|{open_id}" # Using dynamic OpenID
        game_data.ip_address = "172.190.111.97"
        game_data.language = "en"
        game_data.open_id = open_id
        game_data.access_token = access_token
        game_data.platform_type = platform_type
        game_data.field_99 = str(platform_type)
        game_data.field_100 = str(platform_type)

        serialized_data = game_data.SerializeToString()
        encrypted_data = encrypt_message(serialized_data, AES_KEY[:16], AES_IV[:16])
        hex_encrypted_data = binascii.hexlify(encrypted_data).decode('utf-8')

        url = "https://loginbp.ggpolarbear.com/MajorLogin"
        
        # Headers-এ game_version.py থেকে ডাইনামিক ভ্যালু বসানো হয়েছে
        headers = {
            "User-Agent": f"Dalvik/2.1.0 (Linux; U; {game_version.ANDROID_OS_VERSION}; {game_version.USER_AGENT_MODEL} Build/QKQ1)",
            "Connection": "Keep-Alive",
            "Accept-Encoding": "gzip",
            "Content-Type": "application/octet-stream",
            "Expect": "100-continue",
            "X-Unity-Version": game_version.UNITY_VERSION,
            "X-GA": "v1 1",
            "ReleaseVersion": game_version.RELEASE_VERSION
        }
        edata = bytes.fromhex(hex_encrypted_data)

        response = requests.post(url, data=edata, headers=headers, timeout=15)

        if response.status_code == 200:
            try:
                example_msg = output_pb2.Garena_420()
                example_msg.ParseFromString(response.content)
                jwt_token = getattr(example_msg, "token", None)
                if jwt_token:
                    return {"success": True, "jwt_token": jwt_token}
            except:
                data_dict = response.json()
                if data_dict and "token" in data_dict:
                    return {"success": True, "jwt_token": data_dict["token"]}
                    
        return {"success": False, "error": "Failed to generate JWT from Game Server."}
    except Exception as e:
        return {"success": False, "error": f"MajorLogin Error: {str(e)}"}

# ====================
# Frontend Route
# ====================
@app.route("/")
def index():
    return render_template("index.html")

# ====================
# API Routes
# ====================
@app.route("/api/parse-url", methods=["POST"])
def parse_url():
    data = request.json
    url = data.get('url', '')
    if not url:
        return jsonify({"success": False, "message": "URL is required"}), 400

    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    
    if parsed.fragment:
        frag_params = parse_qs(parsed.fragment)
        params.update(frag_params)

    extracted_data = {k: v[0] for k, v in params.items()}
    
    return jsonify({"success": True, "data": extracted_data})

@app.route("/api/generate-token", methods=["POST"])
def api_generate_token():
    data = request.json
    token_type = data.get("type") 
    raw_input = data.get("eat_token", "").strip()
    
    if not raw_input:
         return jsonify({"success": False, "message": "EAT Token or URL is required"}), 400
         
    # ----------------------------------------------------
    # URL থেকে eat টোকেন আলাদা করার লজিক
    # ----------------------------------------------------
    eat_token = raw_input
    
    # ইনপুটটি যদি একটি লিংকের মতো হয় (http/https দিয়ে শুরু হয়)
    if raw_input.startswith("http://") or raw_input.startswith("https://"):
        parsed = urlparse(raw_input)
        params = parse_qs(parsed.query)
        
        # কিছু ক্ষেত্রে টোকেন ফ্র্যাগমেন্টেও (#) থাকতে পারে
        if not params and parsed.fragment:
             params = parse_qs(parsed.fragment)
             
        if 'eat' in params:
            eat_token = params['eat'][0]
        else:
            return jsonify({"success": False, "message": "URL-এর ভেতরে কোনো EAT Token পাওয়া যায়নি!"}), 400
    # ----------------------------------------------------
         
    # Access Token Generation Logic
    if token_type == "access":
        result = extract_access_token_from_eat(eat_token)
        if result.get("success"):
            return jsonify({"success": True, "token": result["access_token"], "token_name": "ACCESS TOKEN"})
        else:
            return jsonify({"success": False, "message": result.get("error", "Failed to extract Access Token")}), 400
            
    # JWT Token Generation Logic
    elif token_type == "jwt":
        ext_res = extract_access_token_from_eat(eat_token)
        if not ext_res.get("success"):
             return jsonify({"success": False, "message": ext_res.get("error", "Failed to validate EAT Token")}), 400
        
        jwt_res = generate_jwt_via_major_login(ext_res["access_token"], ext_res["open_id"], ext_res["platform_type"])
        if jwt_res.get("success"):
             return jsonify({"success": True, "token": jwt_res["jwt_token"], "token_name": "JWT TOKEN"})
        else:
             return jsonify({"success": False, "message": jwt_res.get("error", "Failed to generate JWT Token")}), 400
             
    return jsonify({"success": False, "message": "Invalid token type selected."}), 400

if __name__ == "__main__":
    app.run(debug=False, host='0.0.0.0', port=5000)
