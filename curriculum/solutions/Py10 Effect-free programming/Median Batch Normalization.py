def batch_norm(alist, batch_size):
    for i in range(0, len(alist), batch_size):
        if len(alist[i:i+batch_size]) == 1:
            yield [0]
        else:    
            if batch_size % 2 == 1:
                median_batch = sorted(alist[i:i+batch_size])[batch_size//2]
            else:
                median_batch = (sorted(alist[i:i+batch_size])[batch_size//2 - 1] + sorted(alist[i:i+batch_size])[batch_size//2]) / 2
            yield [x - median_batch for x in alist[i:i+batch_size]]