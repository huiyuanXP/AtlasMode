from . import retry as renamed
from .helpers import request_with_retry
import os as operating

def fetch_notes():
    renamed()
    request_with_retry()
    operating.getcwd()

def dynamic(callback):
    callback()

def shadow(request_with_retry):
    request_with_retry()

def outer():
    def inner():
        return request_with_retry()
    inner()
