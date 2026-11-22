-- 仅清理 qc_probe_% 探针用户及其自有数据（user 12 等原有数据不动）
DELETE FROM photo WHERE user_id IN (SELECT id FROM tb_use WHERE user_name LIKE 'qc_probe_%');
DELETE FROM anneriversaries WHERE user_id IN (SELECT id FROM tb_use WHERE user_name LIKE 'qc_probe_%');
DELETE FROM birth WHERE user_id IN (SELECT id FROM tb_use WHERE user_name LIKE 'qc_probe_%');
DELETE FROM tb_use WHERE user_name LIKE 'qc_probe_%';
