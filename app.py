
from flask import Flask, render_template , request, jsonify, make_response ,  redirect, url_for
from appmanager.controllers.search import process_query
from dotenv import load_dotenv
import os

# Chargement des envs
load_dotenv()

app = Flask(__name__, static_url_path='/static')


@app.route('/', methods=['POST', 'GET'])
def chatbot():
    result = ''
    if request.method == "POST":
        question = request.form.get('question')
        print(question)
        # data = request.get_json()
        # query = data.get('question')
        result = process_query(question)
    return render_template('chatbot.html', response=result)


# Pour choisir le type de module de l'iA
# Sauvegarde des paramètres 
@app.route('/type_module', methods=['POST'])
def traiter_option():
    option_selectionnee = request.form['options']
    if option_selectionnee == 'standard':
        return redirect(url_for(''))
    elif option_selectionnee == 'analyste':
        return redirect(url_for(''))
    else:
        return redirect(url_for(''))


@app.route('/api/chatme', methods=['POST'])
def api_query():
    data = request.get_json()
    query = data.get('question')
    result = process_query(query)
    return make_response(jsonify({'answer': result}), 200)
    

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=os.getenv('DEBUG'))