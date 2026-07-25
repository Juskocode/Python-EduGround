def get_composites(n):
    for i in range(4, n + 1):
        for j in range(2, i):
            if i % j == 0:
                yield i
                break