
ASTRA_DB_SECURE_BUNDLE_PATH = "/Users/emmanuelkouakou/Downloads/secure-connect-vector-g1.zip"
ATRA_DB_APPLICATION_TOKEN = "AstraCS:CEljvPWsLGiGxTEwyLNtFqJl:7ec3c3e63bab04a8af63ecfa7305eb77de44166f52a85fa29c58e278f491bc79"
ASTRA_DB_CLIENT_ID = "CEljvPWsLGiGxTEwyLNtFqJl"
ASTRA_DB_CLIENT_SECRET = "gD1KwdDcOPWYc,YKIcCstY0OuoMQNu.fmReFPk,DjS-uwvAAUtzD2bb2zcU8v,t0kdJq6attC.Pu0QmzE24+KS9usEXhIJ7v-CK2mTdrT0UJeB07aRF.jAv2XNcm609,"
ASTRA_DB_KEYSPACE = "search"
OPENAI_API_KEY = "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"

import os
import openai
os.environ["OPENAI_API_KEY"] = "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"

from langchain.vectorstores.cassandra import Cassandra
from langchain.indexes.vectorstore import VectorStoreIndexWrapper
from langchain.llms import OpenAI 
from langchain.embeddings import OpenAIEmbeddings

from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider

from datasets import load_dataset

print(ASTRA_DB_SECURE_BUNDLE_PATH)

cloud_config = {
    'secure_connect_bundle': ASTRA_DB_SECURE_BUNDLE_PATH
}

 
auth_provider = PlainTextAuthProvider(ASTRA_DB_CLIENT_ID, ASTRA_DB_CLIENT_SECRET) 
cluster = Cluster(cloud=cloud_config, auth_provider=auth_provider)
astraSession = cluster.connect()

llm  = OpenAI(openai_api_key= OPENAI_API_KEY)
myEmbedding = OpenAIEmbeddings(openai_api_key= OPENAI_API_KEY)

myCassandraVStore = Cassandra( 
    embedding=myEmbedding,
    session=astraSession, 
    keyspace=ASTRA_DB_KEYSPACE, 
    table_name="qa_mini_demo",
)



file_path = "products_f.txt"
# Read the text file
with open(file_path, 'r', encoding='utf-8') as file:
    lines = file.readlines()  # read lines of the text file into a list

# You may want to preprocess your text lines here if needed
# For example, if you want only unique lines or to remove empty lines
unique_headlines = list(set(line.strip() for line in lines if line.strip()))

print("\nGenerating embeddings and storing in AstraDB")
# Now use your own data instead of the Hugging Face dataset
myCassandraVStore.add_texts(unique_headlines)

print( "Inserted  %i headlines. \n" % len(unique_headlines))
VectorIndex = VectorStoreIndexWrapper(vectorstore=myCassandraVStore)

first_question = True 
while True : 
    if first_question : 
        query_text = input("\n Bonjour :) , veuillez poser votre question ( ou ecrivez 'quitter' pour quitter) : ")
        first_question = False
    else :
        query_text = input("\n Veuillez poser votre prochaine question ( ou ecrivez 'quitter' pour quitter) : ")
    if query_text.lower() == 'quitter':
        break
    print("Ma demande : \"%s\" "  % query_text)
    answer = VectorIndex.query(query_text, llm=llm).strip()
    print("Gerthe_IA : \"%s\" "  % answer)
#    print("Documents by relevance : ")
#    for doc, score in myCassandraVStore.similarity_search_with_score(query_text, k=4):
#        print(" %0.4f \"%s ...\"" %(score, doc.page_content[:30])  )