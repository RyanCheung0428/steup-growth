"""
ADK (Agent Developer Kit) Functions
时间和文档处理工具函数
"""

from datetime import datetime
import pytz

_HK_TZ = pytz.timezone('Asia/Hong_Kong')
import PyPDF2
import os
import uuid
import json
from typing import Optional, Dict, List


def get_current_time(timezone: str = 'Asia/Hong_Kong') -> str:
    """
    获取当前时间
    
    Args:
        timezone: 时区，默认为香港时间
        
    Returns:
        str: 当前时间的字符串，格式为 "YYYY年MM月DD日 HH:MM:SS 星期X"
    """
    try:
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)
        
        weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
        weekday_zh = weekdays[now.weekday()]
        
        return f"{now.strftime('%Y年%m月%d日 %H:%M:%S')} {weekday_zh}"
    except Exception as e:
        # 如果时区有问题，使用香港时间
        now = datetime.now(_HK_TZ)
        weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
        weekday_zh = weekdays[now.weekday()]
        return f"{now.strftime('%Y年%m月%d日 %H:%M:%S')} {weekday_zh}"


def read_pdf(file_path: str, max_pages: Optional[int] = None) -> Dict:
    """
    读取 PDF 文件内容
    
    Args:
        file_path: PDF 文件路径
        max_pages: 最多读取的页数，None 表示读取所有页
        
    Returns:
        dict: 包含 PDF 内容和元数据的字典
            - success: bool, 是否成功
            - text: str, 提取的文本内容
            - num_pages: int, 总页数
            - metadata: dict, PDF 元数据
            - error: str, 错误信息（如果失败）
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return {
                'success': False,
                'error': f'文件不存在: {file_path}'
            }
        
        # 打开 PDF 文件
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            # 获取 PDF 信息
            num_pages = len(pdf_reader.pages)
            metadata = pdf_reader.metadata
            
            # 确定要读取的页数
            pages_to_read = num_pages if max_pages is None else min(max_pages, num_pages)
            
            # 提取文本
            text_content = []
            for page_num in range(pages_to_read):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                text_content.append(f"--- 第 {page_num + 1} 页 ---\n{text}\n")
            
            full_text = '\n'.join(text_content)
            
            # 构建元数据字典
            metadata_dict = {}
            if metadata:
                for key, value in metadata.items():
                    # 移除 PDF 元数据的 '/' 前缀
                    clean_key = key.lstrip('/')
                    metadata_dict[clean_key] = str(value) if value else None
            
            return {
                'success': True,
                'text': full_text,
                'num_pages': num_pages,
                'pages_read': pages_to_read,
                'metadata': metadata_dict,
                'file_path': file_path
            }
            
    except PyPDF2.errors.PdfReadError as e:
        return {
            'success': False,
            'error': f'PDF 读取错误: {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'处理错误: {str(e)}'
        }


def extract_pdf_page(file_path: str, page_number: int) -> Dict:
    """
    提取 PDF 指定页面的内容
    
    Args:
        file_path: PDF 文件路径
        page_number: 页码（从 1 开始）
        
    Returns:
        dict: 包含页面内容的字典
    """
    try:
        if not os.path.exists(file_path):
            return {
                'success': False,
                'error': f'文件不存在: {file_path}'
            }
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            num_pages = len(pdf_reader.pages)
            
            # 检查页码是否有效
            if page_number < 1 or page_number > num_pages:
                return {
                    'success': False,
                    'error': f'页码超出范围。文件共有 {num_pages} 页，请求第 {page_number} 页。'
                }
            
            # 提取指定页面（页码从0开始，所以要减1）
            page = pdf_reader.pages[page_number - 1]
            text = page.extract_text()
            
            return {
                'success': True,
                'page_number': page_number,
                'text': text,
                'total_pages': num_pages
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': f'提取页面错误: {str(e)}'
        }


def get_pdf_info(file_path: str) -> Dict:
    """
    获取 PDF 文件的基本信息（不读取内容）
    
    Args:
        file_path: PDF 文件路径
        
    Returns:
        dict: PDF 文件信息
    """
    try:
        if not os.path.exists(file_path):
            return {
                'success': False,
                'error': f'文件不存在: {file_path}'
            }
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            # 获取基本信息
            num_pages = len(pdf_reader.pages)
            metadata = pdf_reader.metadata
            
            # 文件大小
            file_size = os.path.getsize(file_path)
            file_size_mb = file_size / (1024 * 1024)
            
            # 构建元数据
            metadata_dict = {}
            if metadata:
                for key, value in metadata.items():
                    clean_key = key.lstrip('/')
                    metadata_dict[clean_key] = str(value) if value else None
            
            return {
                'success': True,
                'file_path': file_path,
                'file_size_bytes': file_size,
                'file_size_mb': round(file_size_mb, 2),
                'num_pages': num_pages,
                'metadata': metadata_dict,
                'is_encrypted': pdf_reader.is_encrypted
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': f'获取信息错误: {str(e)}'
        }


# ===== PDF 問卷自動生成與問答儲存功能 =====

class PDFQuestionnaire:
    """
    PDF 問卷自動生成器
    根據 PDF 內容自動生成問題並儲存問答記錄
    支持簡答題和選擇題兩種模式
    """
    
    def __init__(self, pdf_path: str, user_id: str, max_questions: int = 10, question_type: str = 'choice'):
        """
        初始化問卷
        
        Args:
            pdf_path: PDF 文件路徑
            user_id: 使用者 ID
            max_questions: 最多生成的問題數量
            question_type: 問題類型 'choice' (選擇題) 或 'text' (簡答題)
        """
        self.pdf_path = pdf_path
        self.user_id = user_id
        self.max_questions = max_questions
        self.question_type = question_type  # 'choice' or 'text'
        self.test_id = str(uuid.uuid4())
        self.questions = []
        self.answers = []
        self.pdf_content = None
        
        # 自動讀取 PDF 並生成問題
        self._load_pdf()
        if self.pdf_content:
            self.questions = self.generate_questions()
    
    def _load_pdf(self):
        """載入 PDF 內容"""
        result = read_pdf(self.pdf_path, max_pages=self.max_questions)
        if result.get('success'):
            self.pdf_content = result
        else:
            print(f"PDF 載入失敗: {result.get('error')}")
            self.pdf_content = None
    
    def generate_questions(self) -> List[Dict]:
        """
        根據 PDF 內容自動生成問題
        
        Returns:
            List[Dict]: 問題列表，每個問題包含：
                - question: 問題文本
                - type: 'choice' 或 'text'
                - options: 選項列表（選擇題）
                - correct_answer: 正確答案索引（選擇題，可選）
        """
        questions = []
        
        if not self.pdf_content or not self.pdf_content.get('success'):
            questions.append({
                'question': '無法讀取 PDF 內容，請確認檔案。',
                'type': 'text',
                'options': None
            })
            return questions
        
        text = self.pdf_content.get('text', '')
        
        # 以每頁為單位，取有意義的句子作為問題
        pages = text.split('---')
        for page_text in pages:
            if not page_text.strip():
                continue
            
            # 清理頁面文本
            lines = [l.strip() for l in page_text.split('\n') if l.strip()]
            
            # 過濾掉頁碼標記、純數字等無意義內容
            content_lines = []
            for line in lines:
                # 跳過頁碼標記
                if line.startswith('第') and '页' in line:
                    continue
                # 跳過純數字或很短的行
                if line.isdigit() or len(line) < 10:
                    continue
                content_lines.append(line)
            
            if content_lines:
                # 取第一句有意義的內容作為問題基礎
                first_sentence = content_lines[0]
                
                if self.question_type == 'choice':
                    # 生成選擇題
                    question_text = f"以下哪個描述最符合文檔內容？"
                    
                    # 使用實際內容作為正確選項
                    if len(first_sentence) > 60:
                        correct_option = first_sentence[:60] + "..."
                    else:
                        correct_option = first_sentence
                    
                    # 生成干擾選項
                    options = [
                        correct_option,
                        "這不是文檔中提到的內容",
                        "文檔中沒有相關描述",
                        "以上皆非"
                    ]
                    
                    # 如果有更多內容行，用它們作為干擾選項
                    if len(content_lines) > 1:
                        for i, line in enumerate(content_lines[1:4], 1):
                            if i < 3 and len(line) > 15:
                                if len(line) > 60:
                                    options[i] = line[:60] + "..."
                                else:
                                    options[i] = line
                    
                    # 隨機打亂選項（但記住正確答案位置）
                    import random
                    correct_index = 0  # 正確答案原本在索引 0
                    shuffled_options = options.copy()
                    random.shuffle(shuffled_options)
                    # 找到正確答案的新位置
                    new_correct_index = shuffled_options.index(options[correct_index])
                    
                    questions.append({
                        'question': question_text,
                        'type': 'choice',
                        'options': shuffled_options,
                        'correct_answer': new_correct_index,
                        'context': first_sentence  # 保存原始上下文
                    })
                else:
                    # 生成簡答題
                    if len(first_sentence) > 80:
                        question_text = f"請簡述：{first_sentence[:80]}..."
                    else:
                        question_text = f"請簡述：{first_sentence}"
                    
                    questions.append({
                        'question': question_text,
                        'type': 'text',
                        'options': None
                    })
            
            if len(questions) >= self.max_questions:
                break
        
        # 如果沒有生成任何問題，添加一個默認問題
        if not questions:
            if self.question_type == 'choice':
                questions.append({
                    'question': '這份 PDF 文件的主要目的是什麼？',
                    'type': 'choice',
                    'options': [
                        '提供技術文檔',
                        '教育培訓材料',
                        '研究報告',
                        '其他'
                    ],
                    'correct_answer': 0
                })
            else:
                questions.append({
                    'question': '請總結這份 PDF 文件的主要內容。',
                    'type': 'text',
                    'options': None
                })
        
        return questions
    
    def ask_questions(self):
        """
        問卷互動流程：一問一答（命令行版本）
        支持選擇題和簡答題
        """
        print(f"\n{'='*60}")
        print(f"📝 問卷開始")
        print(f"Test ID: {self.test_id}")
        print(f"User ID: {self.user_id}")
        print(f"問題類型: {'選擇題' if self.question_type == 'choice' else '簡答題'}")
        print(f"{'='*60}\n")
        
        for idx, q_data in enumerate(self.questions, 1):
            question = q_data['question']
            q_type = q_data['type']
            
            print(f"Q{idx}/{len(self.questions)}: {question}")
            
            if q_type == 'choice':
                # 選擇題
                options = q_data['options']
                for opt_idx, option in enumerate(options, 1):
                    print(f"  {opt_idx}. {option}")
                
                while True:
                    answer_input = input(f"\n請選擇 (1-{len(options)}): ").strip()
                    try:
                        answer_num = int(answer_input)
                        if 1 <= answer_num <= len(options):
                            answer = f"{answer_num}. {options[answer_num - 1]}"
                            # 檢查是否正確（如果有正確答案）
                            if 'correct_answer' in q_data:
                                is_correct = (answer_num - 1) == q_data['correct_answer']
                                self.save_qa(question, answer, is_correct=is_correct, question_data=q_data)
                                if is_correct:
                                    print("  ✅ 正確！")
                                else:
                                    print(f"  ❌ 錯誤，正確答案是: {q_data['correct_answer'] + 1}. {options[q_data['correct_answer']]}")
                            else:
                                self.save_qa(question, answer, question_data=q_data)
                            break
                        else:
                            print(f"  ⚠️  請輸入 1-{len(options)} 之間的數字")
                    except ValueError:
                        print("  ⚠️  請輸入有效的數字")
            else:
                # 簡答題
                answer = input("你的答案：")
                self.save_qa(question, answer, question_data=q_data)
            
            print()
        
        print(f"{'='*60}")
        print("✅ 問卷結束，感謝作答！")
        
        # 如果是選擇題，顯示分數
        if self.question_type == 'choice':
            correct_count = sum(1 for ans in self.answers if ans.get('is_correct', False))
            total = len(self.answers)
            score = (correct_count / total * 100) if total > 0 else 0
            print(f"📊 得分: {correct_count}/{total} ({score:.1f}%)")
        
        print(f"{'='*60}\n")
    
    def save_qa(self, question: str, answer: str, is_correct: bool = None, question_data: Dict = None):
        """
        儲存問答紀錄
        
        Args:
            question: 問題
            answer: 答案
            is_correct: 是否正確（選擇題）
            question_data: 完整問題數據
        """
        record = {
            'test_id': self.test_id,
            'user_id': self.user_id,
            'question': question,
            'answer': answer,
            'timestamp': datetime.now(_HK_TZ).replace(tzinfo=None).isoformat()
        }
        
        # 選擇題額外信息
        if is_correct is not None:
            record['is_correct'] = is_correct
        
        if question_data:
            record['question_type'] = question_data['type']
            if question_data['type'] == 'choice':
                record['options'] = question_data['options']
                if 'correct_answer' in question_data:
                    record['correct_answer_index'] = question_data['correct_answer']
        
        self.answers.append(record)
    
    def save_to_file(self, output_path: Optional[str] = None):
        """
        將問答記錄儲存到文件
        
        Args:
            output_path: 輸出文件路徑，默認為 qa_logs/test_id.json
        """
        if output_path is None:
            os.makedirs('qa_logs', exist_ok=True)
            output_path = f'qa_logs/{self.test_id}.json'
        
        data = {
            'test_id': self.test_id,
            'user_id': self.user_id,
            'pdf_path': self.pdf_path,
            'created_at': datetime.now(_HK_TZ).replace(tzinfo=None).isoformat(),
            'questions': self.questions,
            'answers': self.answers,
            'pdf_info': {
                'num_pages': self.pdf_content.get('num_pages') if self.pdf_content else 0,
                'file_path': self.pdf_content.get('file_path') if self.pdf_content else None
            }
        }
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"✅ 問答記錄已儲存到: {output_path}")
            return output_path
        except Exception as e:
            print(f"❌ 儲存失敗: {str(e)}")
            return None
    
    def get_summary(self) -> Dict:
        """
        獲取問卷摘要
        
        Returns:
            Dict: 包含問卷統計資訊的字典
        """
        summary = {
            'test_id': self.test_id,
            'user_id': self.user_id,
            'question_type': self.question_type,
            'total_questions': len(self.questions),
            'answered_questions': len(self.answers),
            'completion_rate': f"{(len(self.answers) / len(self.questions) * 100):.1f}%" if self.questions else "0%",
            'pdf_pages': self.pdf_content.get('num_pages') if self.pdf_content else 0
        }
        
        # 選擇題額外統計
        if self.question_type == 'choice':
            correct_count = sum(1 for ans in self.answers if ans.get('is_correct', False))
            total = len(self.answers)
            summary['correct_answers'] = correct_count
            summary['score'] = f"{(correct_count / total * 100):.1f}%" if total > 0 else "0%"
        
        return summary


def create_questionnaire_from_pdf(pdf_path: str, user_id: str, max_questions: int = 10, question_type: str = 'choice') -> PDFQuestionnaire:
    """
    快速創建 PDF 問卷
    
    Args:
        pdf_path: PDF 文件路徑
        user_id: 使用者 ID
        max_questions: 最多生成的問題數量
        question_type: 問題類型 'choice' (選擇題) 或 'text' (簡答題)
    
    Returns:
        PDFQuestionnaire: 問卷物件
    """
    return PDFQuestionnaire(pdf_path, user_id, max_questions, question_type)


def load_questionnaire_from_file(file_path: str) -> Dict:
    """
    從文件載入問卷記錄
    
    Args:
        file_path: 問卷記錄文件路徑
    
    Returns:
        Dict: 問卷數據
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {
            'success': True,
            'data': data
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'載入失敗: {str(e)}'
        }


# 示例用法
if __name__ == "__main__":
    print("=" * 70)
    print("ADK (Agent Developer Kit) 功能演示")
    print("=" * 70)
    
    # 時間功能
    print("\n1️⃣  當前時間:", get_current_time())
    
    # PDF 讀取示例
    print("\n2️⃣  PDF 讀取功能:")
    print("   result = read_pdf('example.pdf', max_pages=5)")
    print("   page = extract_pdf_page('example.pdf', 1)")
    print("   info = get_pdf_info('example.pdf')")
    
    # 問卷功能示例
    print("\n3️⃣  PDF 問卷功能:")
    print("   # 創建問卷（選擇題）")
    print("   qnr = PDFQuestionnaire(pdf_path, user_id, max_questions=10, question_type='choice')")
    print("   ")
    print("   # 創建問卷（簡答題）")
    print("   qnr = PDFQuestionnaire(pdf_path, user_id, max_questions=10, question_type='text')")
    print("   ")
    print("   # 命令行互動模式")
    print("   qnr.ask_questions()")
    print("   ")
    print("   # 儲存到文件")
    print("   qnr.save_to_file()")
    print("   ")
    print("   # 獲取摘要（選擇題會顯示分數）")
    print("   summary = qnr.get_summary()")
    
    print("\n" + "=" * 70)
    print("💡 使用問卷功能：")
    print("=" * 70)
    
    # 互動式問卷示例
    choice = input("\n是否要測試問卷功能？(y/n): ").strip().lower()
    if choice == 'y':
        pdf_path = input("請輸入 PDF 檔案路徑：").strip()
        user_id = input("請輸入使用者 ID：").strip()
        max_q = input("最多幾題？(預設10)：").strip() or "10"
        q_type = input("問題類型 (1=選擇題, 2=簡答題, 預設=選擇題)：").strip()
        
        question_type = 'text' if q_type == '2' else 'choice'
        
        try:
            qnr = PDFQuestionnaire(pdf_path, user_id, int(max_q), question_type)
            print(f"\n✅ 成功生成 {len(qnr.questions)} 道{'選擇題' if question_type == 'choice' else '簡答題'}！")
            print(f"Test ID: {qnr.test_id}\n")
            
            # 顯示問題預覽
            print("問題預覽：")
            for idx, q_data in enumerate(qnr.questions[:3], 1):
                print(f"  {idx}. {q_data['question']}")
                if q_data['type'] == 'choice' and q_data.get('options'):
                    for opt_idx, opt in enumerate(q_data['options'][:2], 1):
                        print(f"      {opt_idx}. {opt[:50]}...")
                    print(f"      ... (共 {len(q_data['options'])} 個選項)")
            if len(qnr.questions) > 3:
                print(f"  ... (還有 {len(qnr.questions) - 3} 題)")
            
            start = input("\n開始作答？(y/n): ").strip().lower()
            if start == 'y':
                qnr.ask_questions()
                
                # 顯示摘要
                summary = qnr.get_summary()
                print("\n📊 問卷摘要：")
                for key, value in summary.items():
                    print(f"   {key}: {value}")
                
                # 儲存選項
                save = input("\n儲存問答記錄？(y/n): ").strip().lower()
                if save == 'y':
                    qnr.save_to_file()
                    print("\n所有問答記錄：")
                    for qa in qnr.answers:
                        print(f"   Q: {qa['question']}")
                        print(f"   A: {qa['answer']}")
                        print(f"   時間: {qa['timestamp']}\n")
        except Exception as e:
            print(f"❌ 錯誤: {str(e)}")
    else:
        print("\n👋 已跳過問卷測試")



