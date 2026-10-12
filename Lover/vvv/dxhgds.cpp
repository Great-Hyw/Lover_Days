#include <iostream>
using namespace std;
#define M 100
typedef int ElemType;
typedef struct  
{
	ElemType *elem;
	int length;
}sqList;
void CreatList(sqList &l) {
	l.elem = new ElemType[M];
	l.length = 0;
	
}
void addList(sqList& l) {
	int n;
	cout << "输入你要添加的数字";
    	cin >> n;
	if (n > M) {
		cout <<"错误";
		return;
	}
	for (int i = 0; i < n; i++) {
		cin >> l.elem[i];
	}
	l.length = n;

};
void deleteList(sqList &l) {
	cout << "输入你要删除第几个元素";
	int i = 0;
	cin >> i;
	if (i < 1 || i > l.length)return;
	for (int j = i - 1; j < l.length-1;j++) {
		l.elem[j] = l.elem[j + 1];
	}
	--l.length;

};
void insertList(sqList&l) {
	int i; ElemType e;
	cout << "输入你要插入第几个位置和元素";
	cin >> i>>e;
	if (i<1 || i>l.length)return;
	for (int j = l.length; j >= i;j--) {
		l.elem[j] = l.elem[j - 1];
	}
	l.elem[i - 1] = e;
	l.length++;
};
void output(sqList&l) {
	for (int i = 0; i < l.length; i++) {
		cout <<l.elem[i]<<" ";
	}
};
int main() {
	int n;
	sqList l;
	CreatList(l);//创建
	addList(l);//输入
	output(l);//输出
	cout << endl;
	deleteList(l);//删除
	output(l);//输出
	cout << endl;
	insertList(l);//插入
	output(l);//输出
	cout << endl;
	return 0;
}