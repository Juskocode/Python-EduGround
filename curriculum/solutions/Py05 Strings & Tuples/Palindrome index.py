def first_invalid_char_position(length, list_string):
    if length % 2 == 0:
        list1 = list_string[:int(length/2)]
        list2 = list_string[int(length/2):]
        list2.reverse()
        for counter, char in enumerate(list1):
            if char != list2[counter]:
                character_position = counter
                return character_position
        for counter, char in enumerate(list2):
            if char != list1[counter]:
                character_position = length - counter - 1
                return character_position
    else:
        list1 = list_string[:int((length/2))]
        list2 = list_string[(int(length/2) + 1):]
        list2.reverse()
        for counter, char in enumerate(list1):
            if char != list2[counter]:
                character_position = counter
                return character_position
        for counter, char in enumerate(list2):
            if char != list1[counter]:
                character_position = length - counter - 1
                return character_position
    return -1

def first_invalid_char_position_checks_reverse(length, list_string):
    if length % 2 == 0:
        list1 = list_string[:int(length/2)]
        list2 = list_string[int(length/2):]
        list2.reverse()
        for counter, char in enumerate(list2):
            if char != list1[counter]:
                character_position = length - counter - 1
                return character_position
        for counter, char in enumerate(list1):
            if char != list2[counter]:
                character_position = counter
                return character_position
    else:
        list1 = list_string[:int((length/2))]
        list2 = list_string[(int(length/2) + 1):]
        list2.reverse()
        for counter, char in enumerate(list2):
            if char != list1[counter]:
                character_position = length - counter - 1
                return character_position
        for counter, char in enumerate(list1):
            if char != list2[counter]:
                character_position = counter
                return character_position
    return -1

def palindrome_index(s):
    list_string = list(s)
    list_string2 = list(s)
    length = len(list_string)
    character_position = first_invalid_char_position(length, list_string)
    character_position_reversed = first_invalid_char_position_checks_reverse(length, list_string)
    list_string.pop(character_position)
    if first_invalid_char_position(length - 1, list_string) == -1:    
        return character_position
    
    elif character_position != character_position_reversed:
        list_string2.pop(character_position_reversed)
        if first_invalid_char_position(length - 1, list_string2) == -1:    
            return character_position_reversed
        else:
            return -1
    else:
        return -1