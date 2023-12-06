from flask import Flask, render_template, request


app = Flask(__name__)

@app.route('/', methods=['POST', 'GET'])
def chatbot():

    question = ''
    if request.method == "POST":
        question = request.form.get('data')
        print(question)
    return render_template('chatbot.html', reponse=question)



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)


    