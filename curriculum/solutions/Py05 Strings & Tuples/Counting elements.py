def count_until(tup):
    for counter, element in enumerate(tup):
        if type(element) == tuple:
            return counter
    return -1