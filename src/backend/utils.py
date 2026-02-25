import sys
import os
import requests
import time
import shutil
import zipfile
import hashlib

def get_os_name():
    if sys.platform == "win32": return "windows"
    elif sys.platform == "darwin": return "osx"
    return "linux"

def verify_hash(path, expected_hash):
    if not expected_hash: return True
    sha1 = hashlib.sha1()
    try:
        with open(path, 'rb') as f:
            while True:
                data = f.read(65536)
                if not data: break
                sha1.update(data)
        return sha1.hexdigest().lower() == expected_hash.lower()
    except: return False

def download_file(url, path, callback=None, sha1=None):
    if os.path.exists(path):
        if sha1:
            if verify_hash(path, sha1): return
            print(f"Hash mismatch for {path}, redownloading...")
            try: os.remove(path)
            except OSError: pass
        # Если это jar, проверяем, что архив не битый
        elif path.endswith(".jar"):
            try:
                with zipfile.ZipFile(path, 'r') as z:
                    if z.testzip() is not None:
                        raise zipfile.BadZipFile("CRC mismatch")
            except zipfile.BadZipFile:
                print(f"Обнаружен поврежденный файл: {path}. Перекачиваем...")
                try: os.remove(path)
                except OSError: pass
            else:
                return # Файл цел
        else:
            return # Файл существует, пропускаем скачивание

    max_retries = 3
    for attempt in range(max_retries):
        try:
            if callback:
                callback.get("setStatus", lambda x: None)(f"Скачивание: {os.path.basename(path)}")
                
            os.makedirs(os.path.dirname(path), exist_ok=True)
            print(f"Скачивание: {os.path.basename(path)} (Попытка {attempt+1})")
            
            resp = requests.get(url, stream=True, timeout=15)
            resp.raise_for_status()
            
            temp_path = path + ".tmp"
            with open(temp_path, 'wb') as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            if os.path.exists(path):
                try: os.remove(path)
                except OSError: pass
            
            shutil.move(temp_path, path)
            
            if sha1 and not verify_hash(path, sha1):
                raise Exception("Downloaded file hash mismatch")
            return
            
        except Exception as e:
            print(f"Ошибка при скачивании {url}: {e}")
            if attempt == max_retries - 1: raise e
            time.sleep(2)