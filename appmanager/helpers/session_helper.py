from flask import Flask, session

class SessionHelper:
    def set_session(self, key, value):
        session[key] = value

    def get_session(self, key, default=None):
        return session.get(key, default)

    def delete_session(self, key):
        session.pop(key, None)


# Definition des 