def pattern_hunting(l1, l2, p):
    result = []
    for counter, element in enumerate(l1):
        if check_pattern(element, p):
            result.append(l2[counter])
    for counter, element in enumerate(l2):
        if check_pattern(element, p):
            result.append(l1[counter])       
    result = sorted(result)
    return result[::-1]

def check_pattern(string, pattern):
    length_pattern = len(pattern)
    length_string = len(string)
    if length_string >= length_pattern:
        current_char = 0
        while current_char + length_pattern <= length_string:
            if string[current_char:current_char + length_pattern] == pattern:
                return True
            current_char += 1
    else:
        return False