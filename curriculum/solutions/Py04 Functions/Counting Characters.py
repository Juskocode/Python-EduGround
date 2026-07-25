def count_chars(word, char):
    count = 0
    for i in word:
        if i == char:
            count += 1
    if count > 0:
        return count
    else:
        return -1