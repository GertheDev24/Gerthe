from flask import Flask, render_template 

app = Flask(__name__)

@app.route('/')
def chatbot():
    return render_template('chatbot.html')
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
    