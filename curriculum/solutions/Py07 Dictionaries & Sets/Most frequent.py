def most_frequent(a_list):
    dict = {}
    for element in a_list:
        if element in dict.keys():
            dict[element] += 1
        else:
            dict[element] = 1
    max_value = 0
    max_keys = []
    for key, value in dict.items():
        if max_value < value:
            max_keys = [key]
            max_value = value
        elif max_value == value:
            max_keys.append(key)
    return max(max_keys)