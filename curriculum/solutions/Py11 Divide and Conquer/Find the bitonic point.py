def bitonic_point(f):
    alist = f()
    previous = -1
    current = 0
    i = 0
    while previous < current:
        i += 1
        previous = current
        current = alist[i + 1]
    return previous