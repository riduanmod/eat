import os
from flask import Flask, render_template, request, jsonify
from urllib.parse import urlparse, parse_qsl

# Vercel-এর জন্য explicitly static এবং template ফোল্ডার ডিক্লেয়ার করা হয়েছে
app = Flask(__name__, static_url_path='/static', static_folder='static', template_folder='templates')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/parse-url', methods=['POST'])
def parse_url():
    data = request.get_json()
    raw_url = data.get('url', '').strip()
    
    if not raw_url:
        return jsonify({"status": "error", "message": "No URL provided"}), 400
        
    try:
        parsed_url = urlparse(raw_url)
        params = dict(parse_qsl(parsed_url.query))
        
        if not params:
            return jsonify({"status": "error", "message": "No parameters found in the provided URL"}), 404
            
        return jsonify({
            "status": "success",
            "data": params
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Vercel-এ পোর্ট এবং ডিবাগ মুড ইগনোর হবে, এটি শুধু লোকাল টেস্টিংয়ের জন্য
if __name__ == '__main__':
    app.run(debug=True, port=5000)
