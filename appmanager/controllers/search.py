import os
import langchain
from langchain.chains import ConversationalRetrievalChain
from langchain.chat_models import ChatOpenAI
from langchain.embeddings import OpenAIEmbeddings
from langchain.llms import OpenAI
from langchain.prompts.prompt import PromptTemplate
from langchain.vectorstores import FAISS
from langchain.embeddings.openai import OpenAIEmbeddings
from appmanager.helpers.data_helper import CsvDataManager

# Désactive les messages verbeux de langchain
langchain.verbose = False

# Configure la clé API OpenAI
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

# chargement des données
csv_manager = CsvDataManager()
data = csv_manager.csv_data

# Crée des embeddings à l'aide de OpenAIEmbeddings
embeddings = OpenAIEmbeddings()

# Utilise FAISS pour créer des vecteurs à partir des documents et des embeddings
vectors = FAISS.from_documents(data, embeddings)


# Crée une chaîne de récupération conversationnelle basée sur le modèle ChatOpenAI
qa_template = """
 Vous êtes un assistant IA utile nommé GertheAI.
 L'utilisateur vous demande des informations sur le fichier

 context: {context}
 =========
 question: {question}
 ======

 """

QA_PROMPT = PromptTemplate(template=qa_template, input_variables=["context","question" ])

llm = ChatOpenAI(model="gpt-3.5-turbo")
retriever = vectors.as_retriever()


# Create a question-answering chain using the index
chain = ConversationalRetrievalChain.from_llm(
  llm=llm,
  retriever=retriever,
  verbose=True, return_source_documents=True,
  combine_docs_chain_kwargs={'prompt': QA_PROMPT}
)


# Demarrage du chat
chat_history = []


def process_query(query):
    global chat_history
    chain_input = {"question": query, "chat_history": chat_history}
    result = chain(chain_input)
    chat_history.append((query, result['answer']))
    return result['answer']