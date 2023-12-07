from functools import lru_cache
from langchain.document_loaders import CSVLoader

class CsvDataManager:
    def __init__(self, file_path='static/produits_en_vente_2111.csv', encoding="utf-8", csv_args={'delimiter': ','}):
        self.file_path = file_path
        self.encoding = encoding
        self.csv_args = csv_args

    @property
    @lru_cache(maxsize=None)
    def csv_data(self):
        print("Chargement du fichier CSV...")
        loader = CSVLoader(file_path=self.file_path, encoding=self.encoding, csv_args=self.csv_args)
        data = loader.load()
        return data


