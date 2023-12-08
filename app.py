
from flask import Flask, render_template , request, jsonify, make_response
from appmanager.controllers.search import process_query
from dotenv import load_dotenv
import os

# Chargement des envs
load_dotenv()

app = Flask(__name__, static_url_path='/static')

@app.route('/', methods=['POST', 'GET'])
def chatbot():
    # result = ''
    # if request.method == "POST":
    #     question = request.form.get('question')
    #     print(question)
    #     # data = request.get_json()
    #     # query = data.get('question')
    #     result = process_query(question)
    return render_template('chatbot.html')



@app.route('/api/chatme', methods=['POST'])
def api_query():
    data = request.get_json()
    query = data.get('question')
    result = process_query(query)
    return make_response(jsonify({'answer': result}), 200)
    

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=os.getenv('DEBUG'))