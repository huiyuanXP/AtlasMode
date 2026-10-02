def request_with_retry():
    return 1

class Client:
    def send(self):
        return request_with_retry()

    def run(self):
        return self.send()
