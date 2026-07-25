def sort_by_value(dict):
    dict_values = list(dict.values())
    dict_values = sorted(dict_values)
    result_list = []
    for element in dict_values:
        for key, value in dict.items():
            if value == element:
                break
        result_list.append((key, element))
    return result_list