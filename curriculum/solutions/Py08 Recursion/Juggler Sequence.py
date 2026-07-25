from math import sqrt

def juggler(n, p):
    if p == 0:
        return n
    if int(juggler(n, p - 1)) % 2 == 0:
        return int(sqrt(juggler(n, p - 1)))
    return int(juggler(n, p - 1) ** 1.5) 