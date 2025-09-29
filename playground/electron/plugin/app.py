from flask import Flask, jsonify
app = Flask(__name__)
@app.route('/api/hello', methods=['POST'])
def hello():
    request_data = request.get_json()
    return jsonify(message=f'Hello, World!{" You sent: " + str(request_data) if request_data else ""}')

if __name__ == '__main__':
    app.run(port=5328, debug=True)