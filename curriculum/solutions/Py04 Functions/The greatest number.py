def greatest(num):
    num = str(num)
    digits = []
    for digit in num:
        digits.append(digit)
    digits.sort(reverse=True)
    num = ''
    for digit in digits:
        num += digit 
    return(int(num))