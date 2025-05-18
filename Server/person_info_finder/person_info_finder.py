import requests
import os
import json
import argparse
from bs4 import BeautifulSoup
from googlesearch import search
import sqlite3
import time
from datetime import datetime
import logging
from typing import Optional, List, Dict, Any, Tuple

# Import database functionality
from database.database_handler import (
    get_db_connection,
    get_scan_history,
    get_user_id,
    get_scan_history_by_id
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PersonInfoFinder:
    """
    A tool to search for information about a person based on their ID,
    collect data from online sources, and return structured data for frontend use.
    """
    
    def __init__(self, db_path="people_database.db"):
        """Initialize the PersonInfoFinder with database connection."""
        self.db_path = db_path
        self.initialize_database()
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
    def initialize_database(self):
        """Set up the SQLite database if it doesn't exist."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create people table if not exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS people (
            id TEXT PRIMARY KEY,
            name TEXT,
            search_date TEXT,
            data_json TEXT
        )
        ''')
        
        conn.commit()
        conn.close()
    
    def check_if_person_exists(self, person_id):
        """Check if person with the given ID already exists in the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        return result is not None
    
    def search_person_online(self, person_id, num_results=10):
        """Search online for information about the person."""
        logger.info(f"Searching for information about person with ID: {person_id}")
        
        # Data structure to store collected information
        person_data = {
            "id": person_id,
            "name": None,
            "possible_names": [],
            "social_profiles": [],
            "education": [],
            "employment": [],
            "locations": [],
            "interests": [],
            "contact_info": [],
            "summary": "",
            "sources": []
        }
        
        # Search queries to get more complete information
        search_queries = [
            f"{person_id} identity profile",
            f"{person_id} person information",
            f"{person_id} contact information",
            f"{person_id} social media profiles",
            f"{person_id} background information"
        ]
        
        all_urls = []
        
        # Collect search results
        for query in search_queries:
            try:
                logger.info(f"Searching with query: {query}")
                search_results = search(query, num_results=3)
                for url in search_results:
                    if url not in all_urls:
                        all_urls.append(url)
                        person_data["sources"].append({"url": url, "title": ""})
                
                # Be nice to search engines
                time.sleep(2)
            except Exception as e:
                logger.error(f"Search error: {e}")
        
        # Process each URL to extract information
        for i, url in enumerate(all_urls):
            try:
                logger.info(f"Processing URL: {url}")
                response = requests.get(url, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Extract title for the source
                    title_tag = soup.find('title')
                    if title_tag and title_tag.text:
                        person_data["sources"][i]["title"] = title_tag.text.strip()
                    
                    # Look for names
                    self._extract_names(soup, person_data)
                    
                    # Look for social profiles
                    self._extract_social_profiles(soup, person_data)
                    
                    # Look for education and employment
                    self._extract_education_employment(soup, person_data)
                    
                    # Look for location information
                    self._extract_locations(soup, person_data)
                    
                    # Look for contact information
                    self._extract_contact_info(soup, person_data)
                    
                    # Extract interests
                    self._extract_interests(soup, person_data)
                    
                # Be nice to servers
                time.sleep(2)
            except Exception as e:
                logger.error(f"Error processing {url}: {e}")
        
        # Set the most likely name
        if person_data["possible_names"]:
            # Simple frequency-based approach for demonstration
            name_count = {}
            for name in person_data["possible_names"]:
                name_count[name] = name_count.get(name, 0) + 1
            
            person_data["name"] = max(name_count.items(), key=lambda x: x[1])[0]
        
        # Generate a summary
        person_data["summary"] = self._generate_summary(person_data)
        
        return person_data
    
    def _extract_names(self, soup, person_data):
        """Extract potential names from the webpage."""
        # Look for common name patterns in headings and structured data
        headings = soup.find_all(['h1', 'h2', 'h3'])
        for heading in headings:
            text = heading.get_text().strip()
            # Simple heuristic for names - typically 2-3 words, 10-40 chars
            words = text.split()
            if 2 <= len(words) <= 4 and 10 <= len(text) <= 40:
                if text not in person_data["possible_names"]:
                    person_data["possible_names"].append(text)
        
        # Look for structured data like vcard
        vcard = soup.find(class_='vcard')
        if vcard:
            name_tag = vcard.find(class_='fn')
            if name_tag and name_tag.text.strip():
                name = name_tag.text.strip()
                if name not in person_data["possible_names"]:
                    person_data["possible_names"].append(name)
    
    def _extract_social_profiles(self, soup, person_data):
        """Extract social media profile links."""
        social_platforms = [
            'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
            'github.com', 'youtube.com', 'medium.com'
        ]
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            for platform in social_platforms:
                if platform in href:
                    profile = {
                        "platform": platform.split('.')[0].capitalize(),
                        "url": href
                    }
                    if profile not in person_data["social_profiles"]:
                        person_data["social_profiles"].append(profile)
    
    def _extract_education_employment(self, soup, person_data):
        """Extract education and employment information."""
        # This is a simplified implementation - would be more complex in real-world
        education_keywords = ['university', 'college', 'school', 'academy', 'institute', 'degree']
        employment_keywords = ['worked at', 'employed by', 'company', 'corporation', 'job', 'position']
        
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text().lower()
            
            # Check for education info
            for keyword in education_keywords:
                if keyword in text:
                    # Extract sentence containing keyword (simplified)
                    sentences = text.split('.')
                    for sentence in sentences:
                        if keyword in sentence and sentence.strip() not in person_data["education"]:
                            person_data["education"].append(sentence.strip())
            
            # Check for employment info
            for keyword in employment_keywords:
                if keyword in text:
                    # Extract sentence containing keyword (simplified)
                    sentences = text.split('.')
                    for sentence in sentences:
                        if keyword in sentence and sentence.strip() not in person_data["employment"]:
                            person_data["employment"].append(sentence.strip())
    
    def _extract_locations(self, soup, person_data):
        """Extract location information."""
        location_keywords = ['lives in', 'located in', 'from', 'city', 'country', 'state']
        
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text().lower()
            
            for keyword in location_keywords:
                if keyword in text:
                    # Extract sentence containing keyword (simplified)
                    sentences = text.split('.')
                    for sentence in sentences:
                        if keyword in sentence and sentence.strip() not in person_data["locations"]:
                            person_data["locations"].append(sentence.strip())
    
    def _extract_contact_info(self, soup, person_data):
        """Extract contact information."""
        # Look for email addresses
        # This is a very simplified approach - real implementation would use regex
        for a in soup.find_all('a', href=True):
            if 'mailto:' in a['href']:
                email = a['href'].replace('mailto:', '')
                contact = {"type": "email", "value": email}
                if contact not in person_data["contact_info"]:
                    person_data["contact_info"].append(contact)
        
        # Look for phone numbers (simplified)
        text = soup.get_text()
        # Would use regex in real implementation
        phone_indicators = ['phone:', 'tel:', 'call:', 'phone number:']
        for indicator in phone_indicators:
            if indicator in text.lower():
                idx = text.lower().find(indicator)
                # Very crude extraction - real implementation would be more sophisticated
                potential_phone = text[idx:idx+25]
                contact = {"type": "phone", "value": potential_phone}
                if contact not in person_data["contact_info"]:
                    person_data["contact_info"].append(contact)
    
    def _extract_interests(self, soup, person_data):
        """Extract possible interests and hobbies."""
        interest_keywords = ['interests', 'hobbies', 'enjoys', 'passionate about', 'likes', 'fan of']
        
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text().lower()
            
            for keyword in interest_keywords:
                if keyword in text:
                    sentences = text.split('.')
                    for sentence in sentences:
                        if keyword in sentence and sentence.strip() not in person_data["interests"]:
                            person_data["interests"].append(sentence.strip())
    
    def _generate_summary(self, person_data):
        """Generate a summary of the collected information."""
        summary = []
        
        if person_data["name"]:
            summary.append(f"The person with ID {person_data['id']} appears to be {person_data['name']}.")
        else:
            summary.append(f"Could not determine the name of the person with ID {person_data['id']}.")
        
        if person_data["social_profiles"]:
            platforms = [p["platform"] for p in person_data["social_profiles"]]
            summary.append(f"They have profiles on {', '.join(platforms)}.")
        
        if person_data["education"]:
            summary.append("Education information was found.")
        
        if person_data["employment"]:
            summary.append("Employment history was found.")
            
        if person_data["locations"]:
            summary.append("Location information was found.")
        
        if person_data["contact_info"]:
            contact_types = [c["type"] for c in person_data["contact_info"]]
            summary.append(f"Contact information found: {', '.join(contact_types)}.")
        
        return " ".join(summary)
    
    def save_to_database(self, person_data):
        """Save person information to the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT OR REPLACE INTO people (id, name, search_date, data_json) VALUES (?, ?, ?, ?)",
            (
                person_data['id'],
                person_data['name'],
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                json.dumps(person_data)
            )
        )
        
        conn.commit()
        conn.close()
    
    def get_person_data(self, person_id):
        """Get person data from the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT data_json FROM people WHERE id = ?", (person_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            return json.loads(result[0])
        else:
            return None
    
    def process_person(self, person_id, force_refresh=False):
    # Check if we already have information about this person
        if not force_refresh and self.check_if_person_exists(person_id):
            logger.info(f"Person with ID {person_id} already exists in database. Use force_refresh=True to update.")
            person_data = self.get_person_data(person_id)
            if person_data:
                return person_data
        
        try:
            # Search for person information online
            logger.info(f"Searching for information about person: {person_id}")
            person_data = self.search_person_online(person_id)
            
            # Save to database
            self.save_to_database(person_data)
            
            return person_data
        except Exception as e:
            logger.error(f"Error processing person {person_id}: {str(e)}")
            return None

        # Methods for integration with scan history database

    def get_identifiers_from_scan_history(self, username: str) -> List[str]:
        """
        Extract potential identifiers from a user's scan history
        """
        identifiers = []
        try:
            # Get scan history for the username
            scan_history = get_scan_history(username)
            
            if not scan_history:
                logger.warning(f"No scan history found for user: {username}")
                return []
            
            # Process each scan record to extract potential identifiers
            for scan_id, scan_time, scan_text in scan_history:
                # Extract potential identifiers from scan text
                potential_ids = self._extract_identifiers_from_text(scan_text)
                for pid in potential_ids:
                    if pid not in identifiers:
                        identifiers.append(pid)
                
        except Exception as e:
            logger.error(f"Error getting identifiers from scan history: {e}")
        
        return identifiers
    
    def _extract_identifiers_from_text(self, text: str) -> List[str]:
        """
        Extract potential identifiers from text
        This is a simplified implementation - would use NLP/regex in production
        """
        identifiers = []
        
        # Look for patterns like "ID: XXX" or "identifier: XXX"
        id_indicators = ["id:", "identifier:", "user id:", "person id:", "number:"]
        lines = text.lower().split('\n')
        
        for line in lines:
            for indicator in id_indicators:
                if indicator in line:
                    # Extract text after the indicator
                    parts = line.split(indicator, 1)
                    if len(parts) > 1:
                        # Get the potential ID and clean it
                        potential_id = parts[1].strip().split()[0].strip()
                        # Remove any punctuation
                        potential_id = ''.join(c for c in potential_id if c.isalnum())
                        if potential_id and len(potential_id) >= 4:  # Assuming IDs are at least 4 chars
                            identifiers.append(potential_id)
        
        # If no structured IDs found, look for patterns that might be IDs
        if not identifiers:
            words = text.split()
            for word in words:
                # Look for alphanumeric strings that might be IDs
                clean_word = ''.join(c for c in word if c.isalnum())
                if (len(clean_word) >= 6 and len(clean_word) <= 20 and 
                    any(c.isdigit() for c in clean_word) and 
                    any(c.isalpha() for c in clean_word)):
                    identifiers.append(clean_word)
        
        return identifiers[:5]  # Limit to top 5 to avoid excessive searching
    
    def process_from_scan_history(self, username: str, force_refresh=False):
        """
        Process identifiers found in a user's scan history and return results
        """
        results = []
        
        # Get potential identifiers from scan history
        identifiers = self.get_identifiers_from_scan_history(username)
        
        if not identifiers:
            logger.warning(f"No identifiers found in scan history for user: {username}")
            return {
                "success": False,
                "message": "No identifiers found in scan history",
                "data": []
            }
        
        # Process each identifier
        for identifier in identifiers:
            try:
                result = self.process_person(identifier, force_refresh)
                if result["success"]:
                    results.append(result["data"])
            except Exception as e:
                logger.error(f"Error processing identifier {identifier}: {e}")
        
        return {
            "success": True if results else False,
            "message": f"Processed {len(results)} identifiers" if results else "Failed to process any identifiers",
            "data": results
        }

    def process_specific_scan(self, username: str, scan_id: int, force_refresh=False):
        """
        Process a specific scan record to extract and search for identifiers
        """
        results = []
        
        try:
            # Get user ID first
            user_id = get_user_id(username)
            if not user_id:
                logger.warning(f"User not found: {username}")
                return {
                    "success": False,
                    "message": f"User not found: {username}",
                    "data": []
                }
            
            # Get the specific scan record
            scan_records = get_scan_history_by_id(user_id, scan_id)
            
            if not scan_records:
                logger.warning(f"Scan record not found: {scan_id}")
                return {
                    "success": False,
                    "message": f"Scan record not found: {scan_id}",
                    "data": []
                }
            
            # Extract identifiers from the scan text
            for record_id, scan_time, scan_text in scan_records:
                identifiers = self._extract_identifiers_from_text(scan_text)
                
                # Process each identifier
                for identifier in identifiers:
                    try:
                        result = self.process_person(identifier, force_refresh)
                        if result["success"]:
                            results.append(result["data"])
                    except Exception as e:
                        logger.error(f"Error processing identifier {identifier}: {e}")
        
        except Exception as e:
            logger.error(f"Error processing scan record {scan_id}: {e}")
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "data": []
            }
        
        return {
            "success": True if results else False,
            "message": f"Processed {len(results)} identifiers from scan {scan_id}" if results else f"Failed to process any identifiers from scan {scan_id}",
            "data": results
        }

    def get_all_people(self):
        """Get all people from the database for dashboard display."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, name, search_date, data_json FROM people ORDER BY search_date DESC")
        results = cursor.fetchall()
        
        conn.close()
        
        people_data = []
        for id, name, search_date, data_json in results:
            people_data.append({
                "id": id,
                "name": name,
                "search_date": search_date,
                "data": json.loads(data_json)
            })
        
        return people_data

# API Function for Integration with React Frontend
def create_api_endpoints(app, finder):
    """
    Create Flask API endpoints for the PersonInfoFinder
    
    Parameters:
    - app: Flask application instance
    - finder: PersonInfoFinder instance
    """
    @app.route('/api/person-info/<person_id>', methods=['GET'])
    def get_person_info(person_id):
        # Get stored info or search for new info
        result = finder.process_person(person_id, force_refresh=False)
        return result
    
    @app.route('/api/person-info/<person_id>/refresh', methods=['POST'])
    def refresh_person_info(person_id):
        # Force refresh the person information
        result = finder.process_person(person_id, force_refresh=True)
        return result
    
    @app.route('/api/person-info/scan-history/<username>', methods=['GET'])
    def get_scan_history_identifiers(username):
        # Process all scan history for the user
        result = finder.process_from_scan_history(username)
        return result
    
    @app.route('/api/person-info/scan/<username>/<int:scan_id>', methods=['GET'])
    def process_scan(username, scan_id):
        # Process a specific scan
        result = finder.process_specific_scan(username, scan_id)
        return result
    
    @app.route('/api/person-info/all', methods=['GET'])
    def get_all_people_info():
        # Get all people for dashboard display
        people = finder.get_all_people()
        return {
            "success": True,
            "message": f"Found {len(people)} people",
            "data": people
        }

# CLI interface for testing
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Person Information Finder')
    parser.add_argument('--id', help='Person ID to search for')
    parser.add_argument('--force', action='store_true', help='Force refresh of information')
    parser.add_argument('--username', help='Username to process scan history for')
    parser.add_argument('--scan-id', type=int, help='Specific scan ID to process')
    
    args = parser.parse_args()
    
    finder = PersonInfoFinder()
    
    if args.id:
        result = finder.process_person(args.id, force_refresh=args.force)
        print(json.dumps(result, indent=2))
    elif args.username and args.scan_id:
        result = finder.process_specific_scan(args.username, args.scan_id, force_refresh=args.force)
        print(json.dumps(result, indent=2))
    elif args.username:
        result = finder.process_from_scan_history(args.username, force_refresh=args.force)
        print(json.dumps(result, indent=2))
    else:
        print("Please provide at least a person ID (--id) or username (--username)")