def count_zeros(f):
    alist = f()
    length_alist = len(alist)
    lensublst = length_alist // 2
    lst0 = alist[:lensublst]
    lst1 = alist[lensublst:]
    end_lst0 = lst0[lensublst - 1]
    start_lst1 = lst1[0]
    fin_len_sublst = lensublst
    while not (end_lst0 == 1 and start_lst1 == 0):
        if end_lst0 == 1:
            lensublst = len(lst1)//2
            fin_len_sublst += lensublst
            lst0 = lst1[:lensublst]
            lst1 = lst1[lensublst:]
        else:
            lensublst = len(lst0)//2
            fin_len_sublst -= len(lst0) - lensublst
            lst1 = lst0[lensublst:]
            lst0 = lst0[:lensublst]
        end_lst0 = lst0[lensublst - 1]
        start_lst1 = lst1[0]
    return length_alist - fin_len_sublst