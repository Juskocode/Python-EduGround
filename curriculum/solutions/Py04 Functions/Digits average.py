from math import ceil

def digits_average(n):
    if n > 10:
        number_cut = n
        counter = 0
        digit1 = number_cut % 10
        digit2 = (number_cut % 100 - digit1) // 10
        number_cut = number_cut // 10
        n = ceil((digit1 + digit2) / 2 * 10 ** counter)
        counter += 1
        while number_cut > 10:
            digit1 = number_cut % 10
            digit2 = (number_cut % 100 - digit1) // 10
            number_cut = number_cut // 10
            n += ceil((digit1 + digit2) / 2) * 10 ** counter
            counter += 1
        n = digits_average(n)
    return n