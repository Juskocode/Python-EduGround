def biggest_member(atuple):
    biggest_element = atuple
    length = len(biggest_element)
    for element in atuple:
        if type(element) is tuple:
            biggest_element_from_element = biggest_member(element)
            len_biggest_element_from_element = len(biggest_element_from_element)
            if len_biggest_element_from_element > length:
                biggest_element = biggest_element_from_element
                length = len_biggest_element_from_element
    return biggest_element