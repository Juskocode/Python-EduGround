def shorten(suffixes, base):
    def compute(number):
        if type(number) != str:
            return f"{number}"
        if not number.isnumeric():
            return f"{number}"
        for i in range(-1, -len(suffixes) - 1, -1):
            if base**(len(suffixes) + i) <= int(number):
                return str(int(number) // base**(len(suffixes) + i)) + " " + suffixes[i]
    return compute