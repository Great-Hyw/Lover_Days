package com.wei.Service;

import com.wei.pojo.anniversaries;

import java.util.List;

public interface anniversariesService {
    List< anniversaries >Get();

    Integer insertAnn(anniversaries a);

    anniversaries GetannID(Integer id);

    anniversaries update(anniversaries id);

    Object delete(Integer id);
}
