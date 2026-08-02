import os
from flask import Flask, request, jsonify, send_from_directory
from download import get_historic_data

app = Flask(__name__, static_folder='dashboard')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    # Try dashboard folder first
    dashboard_path = os.path.join(app.static_folder, path)
    if os.path.exists(dashboard_path):
        return send_from_directory(app.static_folder, path)
    # Fallback to root (e.g. for District 227 - Mastersheet.json)
    root_path = os.path.join(os.getcwd(), path)
    if os.path.exists(root_path):
        return send_from_directory(os.getcwd(), path)
    return "Not Found", 404

@app.route('/api/historic', methods=['GET'])
def historic_data():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Missing date parameter"}), 400
        
    try:
        data = get_historic_data(date_str)
        return jsonify(data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting local server on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
