import os
import shutil
import hashlib
import sys

def calculate_file_hash(filepath):
    """
    Вычисляет SHA256 хеш файла для сравнения содержимого.
    Позволяет избежать перезаписи файлов, если они не изменились.
    """
    hasher = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
        return hasher.hexdigest()
    except (FileNotFoundError, PermissionError):
        return None

def sync_source_to_data():
    """
    Синхронизирует папку 'src' и файл 'main.py' в папку 'data'.
    - Создает структуру папок.
    - Копирует только новые или измененные файлы.
    - Игнорирует __pycache__ и .pyc файлы.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    
    # Создаем папку data, если её нет
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"[Sync] Created root data directory: {data_dir}")

    items_to_sync = ["src", "main.py"]

    print(f"[Sync] Starting synchronization to {data_dir}...")

    # Создаем папку user для аккаунтов, чтобы избежать ошибок сохранения
    user_dir = os.path.join(data_dir, "user")
    if not os.path.exists(user_dir):
        os.makedirs(user_dir)
        print(f"[Sync] Created user directory: {user_dir}")

    for item in items_to_sync:
        source_path = os.path.join(base_dir, item)
        dest_path = os.path.join(data_dir, item)

        if not os.path.exists(source_path):
            print(f"[Sync] Warning: Source item '{item}' not found in {base_dir}")
            continue

        if os.path.isdir(source_path):
            # Если папки назначения нет, копируем целиком (быстро)
            if not os.path.exists(dest_path):
                shutil.copytree(source_path, dest_path, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
                print(f"[Sync] Copied directory: {item}")
            else:
                # Если папка есть, идем внутрь и сверяем файлы
                for root, dirs, files in os.walk(source_path):
                    # Исключаем кэш Python из обхода
                    dirs[:] = [d for d in dirs if d != '__pycache__']
                    
                    rel_path = os.path.relpath(root, source_path)
                    dest_root = os.path.join(dest_path, rel_path)

                    if not os.path.exists(dest_root):
                        os.makedirs(dest_root)

                    for file in files:
                        if file.endswith('.pyc'): continue
                        
                        src_file = os.path.join(root, file)
                        dst_file = os.path.join(dest_root, file)
                        
                        # Копируем, если файла нет или хеши не совпадают
                        if not os.path.exists(dst_file) or calculate_file_hash(src_file) != calculate_file_hash(dst_file):
                            shutil.copy2(src_file, dst_file)
                            print(f"[Sync] Updated: {os.path.join(item, rel_path, file)}")
        
        elif os.path.isfile(source_path):
            # Синхронизация отдельного файла (main.py)
            if not os.path.exists(dest_path) or calculate_file_hash(source_path) != calculate_file_hash(dest_path):
                shutil.copy2(source_path, dest_path)
                print(f"[Sync] Updated file: {item}")

if __name__ == "__main__":
    try:
        sync_source_to_data()
        print("[Sync] Done.")
    except Exception as e:
        print(f"[Sync] Error: {e}")