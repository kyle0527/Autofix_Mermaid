
import React from 'react';

class UserManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = { users: [] };
  }
  
  async fetchUsers() {
    const response = await fetch('/api/users');
    return response.json();
  }
  
  render() {
    return <div>Users: {this.state.users.length}</div>;
  }
}

export default UserManager;
