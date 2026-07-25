def last_man_standing(a_list, step):
    start_position = -1
    while len(a_list) > 1:
        position_to_eliminate = (start_position + step) % (len(a_list))
        a_list.pop(position_to_eliminate)
        start_position = position_to_eliminate - 1
    return a_list[0]