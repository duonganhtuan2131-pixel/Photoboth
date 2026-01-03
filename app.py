from flask import Flask, render_template, request, jsonify
import os
import base64
from datetime import datetime

# Get the absolute path to the project directory
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, 
            static_folder=os.path.join(basedir, 'static'),
            template_folder=os.path.join(basedir, 'templates'))

# Đảm bảo thư mục lưu ảnh tồn tại
UPLOAD_FOLDER = os.path.join(basedir, 'static', 'image', 'capture')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/save_photo", methods=["POST"])
def save_photo():
    try:
        data = request.get_json()
        image_data = data.get("image")
        
        if not image_data:
            return jsonify({"status": "error", "message": "No image data"}), 400

        # Loại bỏ phần đầu của base64 string (data:image/png;base64,)
        header, encoded = image_data.split(",", 1)
        data_bytes = base64.b64decode(encoded)

        # Tạo tên file duy nhất theo thời gian chụp
        filename = f"capture_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        # Lưu file
        with open(filepath, "wb") as f:
            f.write(data_bytes)

        return jsonify({
            "status": "success", 
            "filename": filename,
            "url": f"/static/image/capture/{filename}"
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Add a route to test static file serving
@app.route("/test")
def test():
    return f"Static folder: {app.static_folder}<br>Template folder: {app.template_folder}"

if __name__ == "__main__":
    app.run(debug=True)
