import os
import sys
import uuid
import json
import requests
import threading
import zipfile
import time
import shutil
import subprocess
import platform
import webview
import minecraft_launcher_lib
from .installers import install_loader
from .utils import download_file

class LauncherApi:
    def __init__(self):
        self._window = None
        self.system = platform.system()
        self.is_64bit = platform.machine().endswith('64')
        self.is_windows = self.system == "Windows"

        if getattr(sys, 'frozen', False):
            self.script_dir = os.path.dirname(sys.executable)
        else:
            self.script_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            
        self.base_dir = os.path.join(self.script_dir, "minecraft_instances")
        if not os.path.exists(self.base_dir): os.makedirs(self.base_dir)
            
        self.user_dir = os.path.join(self.script_dir, "data", "user")
        if not os.path.exists(self.user_dir): os.makedirs(self.user_dir)

        self.config_file = os.path.join(self.script_dir, "data", "launcher_config.json")
        self.java_path = "java"
        self.ram_mb = 2048
        self.client_token = None
        self.ms_client_id = "00000000402b5328"
        self.ms_redirect_uri = None
        self.selected_account_uuid = None
        self.language = "en"
        self.current_account = None

        self.load_config()
        self.load_accounts()
        self.current_instance_name = None
        self.current_account = None
        
        if self.selected_account_uuid:
            for acc in self.accounts_cache:
                if acc.get("uuid") == self.selected_account_uuid:
                    self.set_account(acc["uuid"])
                    break

    def set_window(self, window):
        self._window = window

    def tr(self, key):
        return key

    def get_init_data(self):
        return {
            "instances": self.get_instances(),
            "accounts": self.accounts_cache,
            "current_account": self.current_account,
            "config": {"ram": self.ram_mb, "java_path": self.java_path, "language": self.language}
        }

    def get_instances(self):
        instances = []
        if os.path.exists(self.base_dir):
            dirs = [d for d in os.listdir(self.base_dir) if os.path.isdir(os.path.join(self.base_dir, d))]
            for d in dirs:
                cfg_path = os.path.join(self.base_dir, d, "instance_config.json")
                version = "?"
                loader = "Vanilla"
                if os.path.exists(cfg_path):
                    try:
                        with open(cfg_path, "r") as f:
                            cfg = json.load(f)
                            version = cfg.get("version", "?")
                            loader = cfg.get("loader", "Vanilla")
                    except: pass
                instances.append({"name": d, "version": version, "loader": loader})
        return instances

    def select_instance(self, name):
        self.current_instance_name = name
        print(f"Selected instance: {name}")

    def load_config(self):
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, "r") as f:
                    config = json.load(f)
                    self.java_path = config.get("java_path", "java")
                    self.ram_mb = config.get("ram_mb", 2048)
                    self.client_token = config.get("client_token")
                    self.selected_account_uuid = config.get("selected_account_uuid")
                    self.language = config.get("language", "en")
            except: pass
        
        if not self.client_token: self.client_token = str(uuid.uuid4())
        if not os.path.exists(self.config_file): self.save_config_file()

    def save_settings(self, settings):
        self.java_path = settings.get("java_path", self.java_path)
        self.ram_mb = int(settings.get("ram", self.ram_mb))
        self.language = settings.get("language", self.language)
        self.save_config_file()
        return True

    def save_config_file(self):
        data = {"java_path": self.java_path, "ram_mb": self.ram_mb, "client_token": self.client_token, "language": self.language}
        if self.current_account: data["selected_account_uuid"] = self.current_account.get("uuid")
        with open(self.config_file, "w") as f: json.dump(data, f)

    def load_accounts(self):
        self.accounts_cache = []
        if os.path.exists(self.user_dir):
            for f in os.listdir(self.user_dir):
                if f.endswith(".json"):
                    try:
                        with open(os.path.join(self.user_dir, f), "r") as af:
                            data = json.load(af)
                            self.accounts_cache.append({"type": data.get("type", "unknown"), "username": data.get("username", "unknown"), "uuid": data.get("uuid"), "file": f})
                    except: pass

    def set_account(self, uuid):
        for acc in self.accounts_cache:
            if acc["uuid"] == uuid:
                with open(os.path.join(self.user_dir, acc['file']), 'r') as f: 
                    data = json.load(f)
                
                self.current_account = data
                self.save_config_file()
                return True
        return False

    def add_account_local(self, username):
        data = {"username": username, "uuid": str(uuid.uuid4()), "type": "local"}
        filename = f"local.{username}.json"
        with open(os.path.join(self.user_dir, filename), 'w') as f: json.dump(data, f)
        self.load_accounts()
        return self.accounts_cache

    def add_account_elyby(self, username, password):
        try:
            payload = {"agent": {"name": "Minecraft", "version": 1}, "username": username, "password": password, "clientToken": self.client_token}
            r = requests.post('https://authserver.ely.by/auth/authenticate', json=payload, headers={'Content-Type': 'application/json'}, timeout=15)
            r.raise_for_status()
            data = r.json()
            selected_profile = data.get('selectedProfile', {})
            account = {"type": "elyby", "username": selected_profile.get('name', username), "uuid": selected_profile.get('id'), "accessToken": data.get('accessToken'), "client_token": data.get('clientToken')}
            with open(os.path.join(self.user_dir, f"elyby.{account['username']}.json"), 'w') as f: json.dump(account, f)
            self.load_accounts()
            return self.accounts_cache
        except Exception as e:
            print(f"Ely.by login error: {e}")
            return None

    def delete_account(self, account_uuid):
        for acc in self.accounts_cache:
            if acc["uuid"] == account_uuid:
                try:
                    os.remove(os.path.join(self.user_dir, acc['file']))
                    self.load_accounts()
                    if self.current_account and self.current_account.get("uuid") == account_uuid:
                        self.current_account = None
                        self.save_config_file()
                    return self.accounts_cache
                except Exception as e:
                    print(f"Error deleting account: {e}")
        return False

    def delete_current_account(self):
        if self.current_account:
            return self.delete_account(self.current_account.get("uuid"))
        return False

    def get_mc_versions(self):
        try:
            v_list = minecraft_launcher_lib.utils.get_version_list()
            return [v['id'] for v in v_list if v['type'] == 'release']
        except: return ["1.20.1", "1.19.4", "1.18.2", "1.16.5", "1.12.2"]

    def open_instance_folder(self):
        if not self.current_instance_name: return
        path = os.path.join(self.base_dir, self.current_instance_name)
        if os.path.exists(path):
            if self.is_windows: os.startfile(path)
            else: subprocess.Popen(["xdg-open", path])

    def delete_instance(self):
        if not self.current_instance_name: return
        try:
            shutil.rmtree(os.path.join(self.base_dir, self.current_instance_name))
            self.current_instance_name = None
            return True
        except Exception as e:
            print(e); return False

    def create_instance(self, name, version, loader):
        instance_path = os.path.join(self.base_dir, name)
        if not os.path.exists(instance_path):
            os.makedirs(instance_path)
            with open(os.path.join(instance_path, "instance_config.json"), "w") as f: json.dump({"version": version, "loader": loader}, f)
            return True
        return False

    def launch_game_thread(self):
        threading.Thread(target=self.launch_game).start()

    def launch_game(self):
        if not self.current_instance_name or not self.current_account: return
        instance_dir = os.path.join(self.base_dir, self.current_instance_name)
        with open(os.path.join(instance_dir, "instance_config.json"), "r") as f: config = json.load(f)
        version, loader = config.get("version", "1.20.1"), config.get("loader", "Vanilla")
        
        self._window.evaluate_js(f"updateStatus('{self.tr('installing').format(loader, version)}')")
        self._window.evaluate_js("setLoading(true)")
        
        progress_max = [1]
        def set_max(m): progress_max[0] = max(1, int(m))
        def set_progress(c):
            try:
                p = int((float(c) / float(progress_max[0])) * 100)
                self._window.evaluate_js(f"updateProgress({p})")
            except: pass

        callback = {
            "setStatus": lambda t: self._window.evaluate_js(f"updateStatus('{t.replace(chr(39), chr(92)+chr(39))}')"),
            "setMax": set_max,
            "setProgress": set_progress
        }

        try:
            installed_version_id = install_loader(loader, version, instance_dir, callback, java_path=self.java_path)
            self._window.evaluate_js(f"updateStatus('{self.tr('launching')}')")
            
            final_java_path = self.java_path
            runtime_dir = os.path.join(instance_dir, "runtime")
            if os.path.exists(runtime_dir):
                exe_name = "javaw.exe" if self.is_windows else "java"
                for root, dirs, files in os.walk(runtime_dir):
                    if exe_name in files: final_java_path = os.path.join(root, exe_name); break

            logs_dir = os.path.join(instance_dir, "logs")
            if not os.path.exists(logs_dir): os.makedirs(logs_dir)

            options = {"username": self.current_account["username"], "uuid": self.current_account["uuid"], "token": self.current_account.get("accessToken") or self.current_account.get("access_token") or "", "launcherName": "FoliaLauncher", "gameDirectory": instance_dir, "executablePath": final_java_path, "jvmArguments": [f"-Xmx{self.ram_mb}M", f"-Xms{self.ram_mb}M", f"-XX:ErrorFile={os.path.join(logs_dir, 'hs_err_pid%p.log')}"]}
            minecraft_command = minecraft_launcher_lib.command.get_minecraft_command(installed_version_id, instance_dir, options)
            
            self._window.evaluate_js("hideWindow()")
            
            with open(os.path.join(logs_dir, "game_output.log"), "w", encoding="utf-8") as log_file:
                process = subprocess.Popen(minecraft_command, cwd=instance_dir, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                while True:
                    line = process.stdout.readline()
                    if not line and process.poll() is not None: break
                    if line:
                        try: l = line.decode('utf-8', errors='replace').strip()
                        except: l = str(line).strip()
                        print(l)
                        log_file.write(l + "\n")
                        log_file.flush()
                        self._window.evaluate_js(f"consoleLog('{l.replace(chr(39), chr(92)+chr(39))}')")
            self._window.evaluate_js("showWindow()")
            self._window.evaluate_js(f"updateStatus('{self.tr('game_closed')}')")
        except Exception as e:
            print(e); self._window.evaluate_js(f"updateStatus('{self.tr('error_title')}: {str(e)}')")
        finally: self._window.evaluate_js("gameClosed()")

    def get_installed_mods(self, instance_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        mods_dir = os.path.join(self.base_dir, instance_name, "mods")
        if not os.path.exists(mods_dir): return []
        return [{"name": f, "file_name": f} for f in os.listdir(mods_dir) if f.endswith(".jar")]

    def delete_mod(self, instance_name, file_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        try:
            os.remove(os.path.join(self.base_dir, instance_name, "mods", file_name))
            return True
        except: return False

    def get_installed_resourcepacks(self, instance_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        rp_dir = os.path.join(self.base_dir, instance_name, "resourcepacks")
        if not os.path.exists(rp_dir): return []
        return [{"name": f, "file_name": f} for f in os.listdir(rp_dir) if f.endswith((".zip", ".jar"))]

    def delete_resourcepack(self, instance_name, file_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        try:
            os.remove(os.path.join(self.base_dir, instance_name, "resourcepacks", file_name))
            return True
        except: return False

    def get_installed_shaders(self, instance_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        sp_dir = os.path.join(self.base_dir, instance_name, "shaderpacks")
        if not os.path.exists(sp_dir): return []
        return [{"name": f, "file_name": f} for f in os.listdir(sp_dir) if f.endswith(".zip")]

    def delete_shader(self, instance_name, file_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        try:
            os.remove(os.path.join(self.base_dir, instance_name, "shaderpacks", file_name))
            return True
        except: return False

    def get_installed_datapacks(self, instance_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        dp_dir = os.path.join(self.base_dir, instance_name, "datapacks")
        if not os.path.exists(dp_dir): return []
        return [{"name": f, "file_name": f} for f in os.listdir(dp_dir) if f.endswith(".zip")]

    def delete_datapack(self, instance_name, file_name):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        try:
            os.remove(os.path.join(self.base_dir, instance_name, "datapacks", file_name))
            return True
        except: return False

    def search_modrinth(self, query, instance_name, offset=0, project_type='mod'):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        if not instance_name: return []
        try:
            instance_dir = os.path.join(self.base_dir, instance_name)
            with open(os.path.join(instance_dir, "instance_config.json"), "r") as f: cfg = json.load(f)
            game_version = cfg.get("version")
            loader = cfg.get("loader", "").lower()
            if not game_version: return []
        except: return []
        
        try:
            facets = [[f"versions:{game_version}"], [f"project_type:{project_type}"]]
            if project_type == 'mod':
                valid_loaders = ["fabric", "forge", "quilt", "neoforge"]
                if loader in valid_loaders:
                    facets.append([f"categories:{loader}"])
                else: # Don't search for mods on vanilla
                    return []

            params = {'query': query, 'limit': 20, 'offset': offset, 'facets': json.dumps(facets)}
            headers = {'User-Agent': 'FoliaLauncher/beta-2'}
            if not query:
                params['index'] = 'downloads'
            r = requests.get("https://api.modrinth.com/v2/search", params=params, headers=headers, timeout=15)
            r.raise_for_status()
            hits = r.json().get('hits', [])
            print(f"Modrinth search for '{query}' on '{game_version}/{loader}' returned {len(hits)} hits.")
            return hits
        except Exception as e:
            print(f"Search error (API request): {e}")
            return []

    def search_modrinth_modpacks(self, query, version=None, offset=0):
        try:
            facets = [["project_type:modpack"]]
            if version:
                facets.append([f"versions:{version}"])

            params = {
                'query': query,
                'limit': 20,
                'offset': offset,
                'facets': json.dumps(facets)
            }
            headers = {'User-Agent': 'FoliaLauncher/beta-2'}
            r = requests.get("https://api.modrinth.com/v2/search", params=params, headers=headers, timeout=15)
            r.raise_for_status()
            return r.json().get('hits', [])
        except Exception as e:
            print(f"Modpack search error: {e}")
            return []

    def get_modpack_versions(self, project_id):
        try:
            headers = {'User-Agent': 'FoliaLauncher/beta-2'}
            r = requests.get(f"https://api.modrinth.com/v2/project/{project_id}/version", headers=headers, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"Get versions error: {e}")
            return []

    def open_file_dialog(self):
        result = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=('Modrinth Modpack (*.mrpack)', 'All files (*.*)'))
        return result[0] if result else None

    def _process_mrpack(self, instance_dir, mrpack_path):
        """Internal method to extract and install mrpack"""
        with zipfile.ZipFile(mrpack_path, 'r') as z:
            with z.open("modrinth.index.json") as f:
                index = json.load(f)
            
            # Dependencies
            mc_version = index['dependencies']['minecraft']
            loader = "Vanilla"
            if 'fabric-loader' in index['dependencies']: loader = "Fabric"
            elif 'forge' in index['dependencies']: loader = "Forge"
            elif 'quilt-loader' in index['dependencies']: loader = "Quilt"
            elif 'neoforge' in index['dependencies']: loader = "NeoForge"

            with open(os.path.join(instance_dir, "instance_config.json"), "w") as f:
                json.dump({"version": mc_version, "loader": loader}, f)

            # Download files
            for file_info in index['files']:
                path = os.path.join(instance_dir, file_info['path'])
                os.makedirs(os.path.dirname(path), exist_ok=True)
                download_file(file_info['downloads'][0], path)

            # Extract overrides
            for name in z.namelist():
                if name.startswith("overrides/"):
                    target = os.path.join(instance_dir, name[len("overrides/"):])
                    if not name.endswith("/"):
                        os.makedirs(os.path.dirname(target), exist_ok=True)
                        with z.open(name) as source, open(target, "wb") as dest:
                            shutil.copyfileobj(source, dest)

    def import_mrpack_local(self, instance_name, file_path):
        instance_dir = os.path.join(self.base_dir, instance_name)
        if os.path.exists(instance_dir): return False
        os.makedirs(instance_dir)
        
        try:
            mrpack_path = os.path.join(instance_dir, "modpack.mrpack")
            shutil.copy2(file_path, mrpack_path)
            self._process_mrpack(instance_dir, mrpack_path)
            os.remove(mrpack_path)
            return True
        except Exception as e:
            print(f"Import mrpack error: {e}")
            if os.path.exists(instance_dir): shutil.rmtree(instance_dir)
            return False

    def install_mrpack(self, instance_name, project_id, version_id=None):
        headers = {'User-Agent': 'FoliaLauncher/beta-2'}
        instance_dir = os.path.join(self.base_dir, instance_name)
        
        try:
            # 1. Get latest version info
            if version_id:
                r = requests.get(f"https://api.modrinth.com/v2/version/{version_id}", headers=headers, timeout=15)
                r.raise_for_status()
                version_data = r.json()
            else:
                r = requests.get(f"https://api.modrinth.com/v2/project/{project_id}/version", headers=headers, timeout=15)
                r.raise_for_status()
                versions = r.json()
                if not versions: return False
                version_data = versions[0]

            # 2. Find mrpack file
            mrpack_file = next((f for f in version_data['files'] if f['filename'].endswith('.mrpack')), None)
            if not mrpack_file: return False

            if os.path.exists(instance_dir): return False
            os.makedirs(instance_dir)

            # 3. Download mrpack
            mrpack_path = os.path.join(instance_dir, "modpack.mrpack")
            download_file(mrpack_file['url'], mrpack_path)

            self._process_mrpack(instance_dir, mrpack_path)

            os.remove(mrpack_path)
            return True
        except Exception as e:
            print(f"Install mrpack error: {e}")
            if os.path.exists(instance_dir): shutil.rmtree(instance_dir)
            return False

    def install_item_from_modrinth(self, instance_name, project_id):
        if isinstance(instance_name, dict): instance_name = instance_name.get("name")
        try:
            instance_dir = os.path.join(self.base_dir, instance_name)
            with open(os.path.join(instance_dir, "instance_config.json"), "r") as f: cfg = json.load(f)
            
            loader = cfg.get("loader", "").lower()
            version = cfg.get("version")
            
            headers = {'User-Agent': 'FoliaLauncher/beta-2'}
            
            # We need to get project type first to construct the version query
            project_info_res = requests.get(f"https://api.modrinth.com/v2/project/{project_id}", headers=headers, timeout=15)
            project_info_res.raise_for_status()
            project_info = project_info_res.json()
            project_type = project_info.get("project_type")

            params = {'game_versions': json.dumps([version])}
            if project_type == 'mod':
                params['loaders'] = json.dumps([loader])
            
            r = requests.get(f"https://api.modrinth.com/v2/project/{project_id}/version", params=params, headers=headers, timeout=15)
            r.raise_for_status()
            versions = r.json()
            
            if not versions: return {"success": False, "error": self.tr("no_compatible")}
            
            file_data = versions[0]['files'][0]
            sha1 = file_data.get('hashes', {}).get('sha1')
            
            folder_map = {
                "mod": "mods",
                "resourcepack": "resourcepacks",
                "shaderpack": "shaderpacks",
                "datapack": "datapacks"
            }
            target_folder_name = folder_map.get(project_type, "mods")
            target_dir = os.path.join(instance_dir, target_folder_name)
            
            download_file(file_data['url'], os.path.join(target_dir, file_data['filename']), sha1=sha1)
            
            return {"success": True, "type": project_type}
        except Exception as e:

            return {"success": False, "error": str(e)}
