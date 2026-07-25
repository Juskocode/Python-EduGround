def longest(s):
    list_of_words = s.split()
    max_length = len(list_of_words[0])
    for word in list_of_words:
        if len(word) > max_length:
            max_length = len(word)
    return max_length