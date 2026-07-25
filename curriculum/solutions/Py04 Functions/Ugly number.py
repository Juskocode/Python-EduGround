def ugly(n):
    while n % 5 == 0:
        n = n // 5
    while n % 3 == 0:
        n = n // 3
    while n % 2 == 0:
        n = n // 2
    if n == 1:
        return True
    else:
        return False