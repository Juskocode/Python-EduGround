def summary_ranges(a_string):
    list_string = a_string.split(',')
    result = ""
    while len(list_string) > 0:
        counter = 0
        while counter < len(list_string) - 1:
            if int(list_string[counter]) + 1 == int(list_string[counter + 1]):
                counter += 1
            else:
                break
        if counter > 0:
            result += list_string[0] + "->" + list_string[counter] + ","
            for i in range(counter + 1):
                list_string.pop(0)
        else:
            result += list_string[0] + ","
            list_string.pop(0)
    result = result[:len(result) - 1]
    return result