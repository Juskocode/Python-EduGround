def repeated_letter(s):
    for char in s:
        s = s[1:]
        if char in s:
            return char