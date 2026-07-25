def count_chars(a_string):
    letter = 0
    digit = 0
    other_char = 0
    for char in a_string:
        if char.isalpha():
            letter += 1
        elif char.isdigit():
            digit += 1
        else:
            other_char += 1
    return letter, digit, other_char