
from flask import Flask, render_template , request, jsonify
from appmanager.controllers.search import process_query
from dotenv import load_dotenv
import os

# Chargement des envs
load_dotenv()

app = Flask(__name__, static_url_path='/static')

@app.route('/', methods=['GET'])
def chatbot():
    result = ''
    if request.method == "POST":
        question = request.form.get('question')
        print(question)
        # data = request.get_json()
        # query = data.get('question')
        result = process_query(question)
    return render_template('chatbot.html', response=result)



@app.route('/api/chatme', methods=['POST'])
def api_query():
    data = request.get_json()
    query = data.get('question')
    result = process_query(query)
    return jsonify({'answer': result})
    

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=os.getenv('DEBUG'))