def academy_awards(alist):
    result_dict = {}
    for element in alist:
        if element[1] in result_dict.keys():
            result_dict[element[1]] += 1
        else:
            result_dict[element[1]] = 1
    return result_dict