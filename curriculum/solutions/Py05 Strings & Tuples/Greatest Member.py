def greatest_member(a_tuple):
    max_score = 0
    for element in a_tuple:
        if type(element) == str:
            score_from_current_string_element = get_score_from_str(element)
            if score_from_current_string_element > max_score:
                max_score = score_from_current_string_element
                element_with_max_score = element
        elif type(element) == tuple:
            score_from_current_tuple_element = get_score_from_tuple(element)
            if score_from_current_tuple_element > max_score:
                max_score = score_from_current_tuple_element
                element_with_max_score = element
    if max_score != 0:
        return element_with_max_score
    else:
        return ()

def get_score_from_tuple(a_tuple):
    score = 0
    for element in a_tuple:
        if type(element) == str:
            score += get_score_from_str(element)
        elif type(element) == tuple:
            score += get_score_from_tuple(element)
    return score
            
            
def get_score_from_str(a_string):
    score = 0
    for char in a_string:
        score += ord(char)
    return score