import math

def digits_average(n):
    if n < 10:
        return n
    return digits_average2(n)

def digits_average2(n, avg=0, power=0):
    if n < 10:
        return digits_average(avg)
    avg = avg + math.ceil((n % 10 + (n//10) % 10) / 2) * 10**power
    n //= 10
    power += 1
    return digits_average2(n, avg, power)