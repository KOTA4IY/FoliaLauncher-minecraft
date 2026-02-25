import os
import sys
import json
import requests
import zipfile
import time
import shutil
import subprocess
import xml.etree.ElementTree as ET
import minecraft_launcher_lib
from .utils import get_os_name, download_file

def get_data_root():
    if getattr(sys, 'frozen', False):
        # Если запущен exe, корень - папка с exe
        return os.path.join(os.path.dirname(sys.executable), "data")
    
    # Иначе (в разработке) определяем путь относительно этого файла
    path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(path, "data")

CACHE_DIR = os.path.join(get_data_root(), "modloader")

def check_rules(rules):
    if not rules: return True
    os_name = get_os_name()
    allow = False
    for rule in rules:
        action = rule.get('action')
        os_rule = rule.get('os', {})
        if action == 'allow':
            if not os_rule or os_rule.get('name') == os_name: allow = True
        elif action == 'disallow':
            if not os_rule or os_rule.get('name') == os_name: allow = False
    return allow

def install_libraries(data, instance_dir, callback=None):
    lib_dir = os.path.join(instance_dir, "libraries")
    libs = data.get('libraries', [])
    
    if callback: callback.get("setMax", lambda x: None)(len(libs))
    
    for i, lib in enumerate(libs):
        if callback: callback.get("setProgress", lambda x: None)(i)
        if not check_rules(lib.get('rules')): continue
        
        if 'downloads' in lib:
            downloads = lib['downloads']
            if 'artifact' in downloads:
                art = downloads['artifact']
                download_file(art['url'], os.path.join(lib_dir, art['path']), callback, sha1=art.get('sha1'))
            
            classifiers = downloads.get('classifiers', {})
            native_key = f"natives-{get_os_name()}"
            if native_key in classifiers:
                nat = classifiers[native_key]
                download_file(nat['url'], os.path.join(lib_dir, nat['path']), callback, sha1=nat.get('sha1'))
                
        name = lib.get('name')
        if name:
            parts = name.split(':')
            domain = parts[0].replace('.', '/')
            artifact = parts[1]
            version = parts[2]
            filename = f"{artifact}-{version}.jar"
            path = f"{domain}/{artifact}/{version}/{filename}"
            
            if not ('downloads' in lib and 'artifact' in lib['downloads']):
                base_url = lib.get('url', "https://libraries.minecraft.net/")
                if not base_url.endswith('/'): base_url += '/'
                download_file(base_url + path, os.path.join(lib_dir, path), callback)
    
    if callback: callback.get("setProgress", lambda x: None)(len(libs))

def install_assets(data, instance_dir):
    if 'assetIndex' not in data: return
    idx = data['assetIndex']
    idx_path = os.path.join(instance_dir, "assets", "indexes", f"{idx['id']}.json")
    download_file(idx['url'], idx_path)
    
    if os.path.exists(idx_path):
        with open(idx_path, 'r') as f: idx_data = json.load(f)
        obj_dir = os.path.join(instance_dir, "assets", "objects")
        for obj in idx_data.get('objects', {}).values():
            h = obj['hash']
            download_file(f"https://resources.download.minecraft.net/{h[:2]}/{h}", os.path.join(obj_dir, h[:2], h), sha1=h)

def install_vanilla_manual(version, instance_dir, callback=None):
    print(f"Установка Vanilla {version} через библиотеку...")
    jar_path = os.path.join(instance_dir, "versions", version, f"{version}.jar")
    if os.path.exists(jar_path):
        try:
            with zipfile.ZipFile(jar_path, 'r') as z:
                if z.testzip() is not None: raise zipfile.BadZipFile("CRC mismatch")
        except zipfile.BadZipFile:
            try: os.remove(jar_path)
            except OSError: pass

    if not callback:
        callback = {"setStatus": lambda text: print(f"Status: {text}"), "setProgress": lambda value: None, "setMax": lambda value: None}
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            minecraft_launcher_lib.install.install_minecraft_version(version, instance_dir, callback=callback)
            return version
        except Exception as e:
            print(f"Ошибка установки Vanilla (попытка {attempt+1}): {e}")
            if attempt == max_retries - 1: raise e
            time.sleep(3)

def install_loader(loader_type, version, instance_dir, callback=None, java_path=None):
    print(f"Запуск ручной установки: {loader_type} для {version}")
    install_vanilla_manual(version, instance_dir, callback)

    if loader_type == "Vanilla": return version
    elif loader_type == "Fabric": return install_fabric_manual(version, instance_dir, callback)
    elif loader_type == "Quilt": return install_quilt_manual(version, instance_dir, callback)
    elif loader_type == "Forge": return install_forge_manual(version, instance_dir, java_path, callback)
    elif loader_type == "NeoForge": return install_neoforge_manual(version, instance_dir, java_path, callback)
    return version

def install_fabric_manual(mc_version, mc_dir, callback=None):
    try:
        url = f"https://meta.fabricmc.net/v2/versions/loader/{mc_version}"
        resp = requests.get(url, timeout=15); resp.raise_for_status()
        data = resp.json()
        if not data: raise Exception(f"Fabric не поддерживает версию {mc_version}")
        loader_ver = data[0]["loader"]["version"]
        
        profile_url = f"https://meta.fabricmc.net/v2/versions/loader/{mc_version}/{loader_ver}/profile/json"
        resp = requests.get(profile_url, timeout=15); resp.raise_for_status()
        profile_json = resp.json()
        version_id = profile_json["id"]
        
        ver_dir = os.path.join(mc_dir, "versions", version_id)
        os.makedirs(ver_dir, exist_ok=True)
        with open(os.path.join(ver_dir, f"{version_id}.json"), "w") as f: json.dump(profile_json, f, indent=4)
        
        try: minecraft_launcher_lib.install.install_minecraft_version(version_id, mc_dir, callback=callback)
        except: install_libraries(profile_json, mc_dir, callback)
        
        dummy_jar = os.path.join(ver_dir, f"{version_id}.jar")
        if not os.path.exists(dummy_jar):
            with zipfile.ZipFile(dummy_jar, 'w') as z: pass
        return version_id
    except Exception as e:
        print(f"Ошибка API Fabric: {e}"); raise e

def install_quilt_manual(mc_version, mc_dir, callback=None):
    try:
        url = f"https://meta.quiltmc.org/v3/versions/loader/{mc_version}"
        resp = requests.get(url, timeout=15); resp.raise_for_status()
        data = resp.json()
        if not data: raise Exception(f"Quilt не поддерживает версию {mc_version}")
        loader_ver = data[0]["loader"]["version"]
        
        profile_url = f"https://meta.quiltmc.org/v3/versions/loader/{mc_version}/{loader_ver}/profile/json"
        resp = requests.get(profile_url, timeout=15); resp.raise_for_status()
        profile_json = resp.json()
        version_id = profile_json["id"]
        
        ver_dir = os.path.join(mc_dir, "versions", version_id)
        os.makedirs(ver_dir, exist_ok=True)
        with open(os.path.join(ver_dir, f"{version_id}.json"), "w") as f: json.dump(profile_json, f, indent=4)
        
        try: minecraft_launcher_lib.install.install_minecraft_version(version_id, mc_dir, callback=callback)
        except: install_libraries(profile_json, mc_dir, callback)
        
        dummy_jar = os.path.join(ver_dir, f"{version_id}.jar")
        if not os.path.exists(dummy_jar):
            with zipfile.ZipFile(dummy_jar, 'w') as z: pass
        return version_id
    except Exception as e:
        print(f"Ошибка API Quilt: {e}"); raise e

def install_forge_manual(mc_version, mc_dir, java_path, callback=None):
    promos_url = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json"
    resp = requests.get(promos_url, timeout=15)
    promos = resp.json().get("promos", {})
    forge_ver = promos.get(f"{mc_version}-recommended") or promos.get(f"{mc_version}-latest")
    if not forge_ver: raise Exception(f"Forge не найден для {mc_version}")
        
    full_ver = f"{mc_version}-{forge_ver}"
    installer_url = f"https://maven.minecraftforge.net/net/minecraftforge/forge/{full_ver}/forge-{full_ver}-installer.jar"
    expected_id = f"{mc_version}-forge-{forge_ver}"

    installer_dir = os.path.join(CACHE_DIR, "forge")
    os.makedirs(installer_dir, exist_ok=True)
    installer_path = os.path.join(installer_dir, f"forge-{full_ver}-installer.jar")

    id = download_and_run_installer_cached(installer_url, installer_path, mc_dir, expected_id, java_path)
    try: minecraft_launcher_lib.install.install_minecraft_version(id, mc_dir, callback=callback)
    except Exception as e: print(f"Warning: Forge library check failed: {e}")
    return id

def install_neoforge_manual(mc_version, mc_dir, java_path, callback=None):
    meta_url = "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml"
    resp = requests.get(meta_url, timeout=15)
    root = ET.fromstring(resp.content)
    target_ver = None
    for ver in root.findall(".//version"):
        if mc_version in ver.text: target_ver = ver.text
            
    if not target_ver: raise Exception(f"NeoForge установщик не нашел версию для {mc_version}")

    installer_url = f"https://maven.neoforged.net/releases/net/neoforged/neoforge/{target_ver}/neoforge-{target_ver}-installer.jar"
    installer_dir = os.path.join(CACHE_DIR, "neoforge")
    os.makedirs(installer_dir, exist_ok=True)
    installer_path = os.path.join(installer_dir, f"neoforge-{target_ver}-installer.jar")

    id = download_and_run_installer_cached(installer_url, installer_path, mc_dir, f"neoforge-{target_ver}", java_path)
    try: minecraft_launcher_lib.install.install_minecraft_version(id, mc_dir, callback=callback)
    except Exception as e: print(f"Warning: NeoForge library check failed: {e}")
    return id

def download_and_run_installer_cached(url, installer_path, mc_dir, expected_id, java_path=None):
    if not os.path.exists(installer_path):
        download_file(url, installer_path)
    print("Запуск инсталлера (требуется Java)...")
    if not os.path.exists(os.path.join(mc_dir, "launcher_profiles.json")):
        with open(os.path.join(mc_dir, "launcher_profiles.json"), "w") as f: json.dump({"profiles": {}}, f)
    java_executable = java_path if java_path else "java"
    subprocess.run([java_executable, "-jar", installer_path, "--installClient", mc_dir], check=True)
    return expected_id