def change(money):
    money = money * 100
    result_dict ={
        2.0: 0, 1.0: 0, 0.5: 0, 0.2: 0, 0.1: 0, 0.05: 0, 0.02: 0, 0.01: 0
    }
    for key in result_dict.keys():
        while money / 100 >= key:
            money -= key * 100
            result_dict[key] += 1
    return result_dict


#solução cheese que não funciona por questões de floating point arithmetic
#def change(money):
#    result_dict ={
#        2.0: 0, 1.0: 0, 0.5: 0, 0.2: 0, 0.1: 0, 0.05: 0, 0.02: 0, 0.01: 0
#    }
#    while money >= 2:
#        money -= 2
#        result_dict[2.0] += 1
#    while money >= 1:
#        money -= 1
#        result_dict[1] += 1
#    while money >= 0.5:
#        money -= 0.5
#        result_dict[0.5] += 1
#    while money >= 0.2:
#        money -= 0.2
#        result_dict[0.2] += 1
#    while money >= 0.1:
#        money -= 0.1
#        result_dict[0.1] += 1
#    while money >= 0.05:
#        money -= 0.05
#        result_dict[0.05] += 1
#    while money >= 0.02:
#        money -= 0.02
#        result_dict[0.02] += 1
#    while money >= 0.01:
#        money -= 0.01
#        result_dict[0.01] += 1
#    return result_dict