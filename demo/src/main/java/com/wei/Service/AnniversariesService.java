package com.wei.service;

import com.wei.pojo.Anniversaries;

import java.util.List;

public interface AnniversariesService {
    List<Anniversaries>Get();

    Integer insertAnn(Anniversaries a);

    Anniversaries GetannID(Integer id);

    Anniversaries update(Anniversaries id);

    Object delete(Integer id);
}
